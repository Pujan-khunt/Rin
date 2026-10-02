# Rin Extension Architecture & Low-Level Design (LLD) Refactor Spec

- **Date**: 2026-10-02
- **Author**: Antigravity & Pujan Khunt
- **Scope**: `packages/extension`
- **Status**: Approved for Implementation Planning

---

## 1. Context & Motivation

While `@rin/worker` and `@rin/shared` maintain high architectural cohesion and crisp domain boundaries, `@rin/extension` has accumulated several Low-Level Design (LLD) smells:
1. **Split Configuration Abstractions**: Configuration logic is fragmented between procedural functions in `config/config.ts` and a wrapper class in `services/config.service.ts`. Entrypoints use them inconsistently.
2. **"Teardown Passing Hell" in Detection**: `lifecycle.ts` and `observer.ts` return nested teardown closures (`() => void`) that are imperatively stored, chained, and nullified across files.
3. **Parallel Arrays in Quiz Extraction**: `extractOptions` returns `{ options: QuizOption[], optionElements: HTMLElement[] }`, forcing callers to manage index-aligned parallel arrays.
4. **Ad-Hoc Procedural Entrypoints**: `background.ts` relies on a monolithic `if-else` listener callback mixing routing, configuration, and error handling. `popup/main.ts` is an unstructured DOM manipulation script.
5. **Entangled Dev Concerns**: Dev-only DOM snapshotting, file downloads, and model overrides are inlined across production pipelines using scattered `import.meta.env.DEV` checks.
6. **Anemic Directory Structure**: An arbitrary `interfaces/` bucket and flat `services/` folder obscure domain boundaries.

This refactor establishes a **Domain-Driven Architecture** for `@rin/extension`, with concise naming, strict single-responsibility components, symmetrical lifecycle patterns, and complete separation between production pipelines and diagnostic tooling.

---

## 2. Target File Tree

```
packages/extension/src/
├── actors/                      # Output action strategies
│   ├── types.ts                 # Actor, ActPayload, ActorMode
│   ├── hud.ts                   # HudActor (assisted mode)
│   ├── click.ts                 # ClickActor (auto mode)
│   └── factory.ts               # createActor() via ACTOR_STRATEGIES map
│
├── config/                      # User settings & persistence
│   ├── types.ts                 # RinConfig, ConfigChangeListener
│   ├── defaults.ts              # DEFAULT_CONFIG, DEFAULT_MODEL
│   └── store.ts                 # ConfigStore (browser.storage.local wrapper & reactive pub/sub)
│
├── dom/                         # Shared DOM selectors & utilities
│   ├── selectors.ts             # Scaler Drona CSS selectors (.m-activity, div.m-quiz, etc.)
│   └── utils.ts                 # normalizeWhitespace, findSelfOrDescendant
│
├── meeting/                     # Meeting session lifecycle
│   ├── types.ts                 # MeetingCallbacks
│   └── watcher.ts               # MeetingWatcher (detects enter, unmount, and handles re-arming)
│
├── quiz/                        # Quiz parsing, observing, and execution workflow
│   ├── types.ts                 # DetectedOption, QuizData, QuizObserverCallbacks
│   ├── extractor.ts             # Pure functional DOM parser (question, options, hydration check)
│   ├── observer.ts              # QuizObserver (watches meetingContainer for div.m-quiz & hydration)
│   └── workflow.ts              # QuizWorkflow (orchestrates guard -> solve -> act)
│
├── solver/                      # Solver communication
│   └── client.ts                # WorkerClient (POST /solve on custom domain with error parsing)
│
├── messaging/                   # Extension messaging & logging
│   ├── types.ts                 # ContentMessage, BackgroundResponse, LogPayload, LogLevel
│   ├── messenger.ts             # sendToBackground()
│   ├── router.ts                # MessageRouter (declarative message-to-handler registry)
│   └── logger.ts                # logger dispatcher & prettyPrintLog
│
├── diagnostics/                 # Dev-only tooling & telemetry (isolated)
│   ├── recorder.ts              # Snapshot capture & DOM downloader (Blob)
│   └── hotkeys.ts               # Alt+Shift+S / Ctrl+Alt+S snapshot hotkey listener
│
├── entrypoints/                 # WXT Extension Entrypoints (Composition Roots)
│   ├── background.ts            # Background service worker registering MessageRouter handlers
│   ├── drona.content.ts         # Content script composing MeetingWatcher, QuizObserver, Workflow
│   └── popup/                   # Browser action popup UI
│       ├── index.html
│       ├── popup.css
│       └── main.ts              # Popup controller binding DOM to ConfigStore
│
└── env.d.ts                     # Ambient Vite environment definitions
```

---

## 3. Domain Specifications

### 3.1. Actors (`src/actors/`)

- **`types.ts`**:
  ```ts
  export type ActorMode = 'assisted' | 'auto';

  export interface ActPayload {
    quiz: QuizData;
    result: SolveResult;
  }

  export interface Actor {
    readonly mode: ActorMode;
    act(payload: ActPayload): Promise<void>;
    cleanup(): void;
  }
  ```
- **`factory.ts`**: Replaces the static class and `switch/case` statement with a strategy registry adhering to OCP:
  ```ts
  type ActorConstructor = new () => Actor;

  export const ACTOR_STRATEGIES: Record<ActorMode, ActorConstructor> = {
    assisted: HudActor,
    auto: ClickActor,
  };

  export function createActor(mode: ActorMode): Actor {
    const Strategy = ACTOR_STRATEGIES[mode] ?? HudActor;
    return new Strategy();
  }
  ```
- **`hud.ts`**: Implements `HudActor`, applying `#e8d5f5` background and `#a855f7` border ring to `payload.quiz.options[payload.result.chosenIndex].element`. Preserves original inline styles and reverts them in `cleanup()`.
- **`click.ts`**: Implements `ClickActor`, dispatching the 5-stage synthetic pointer/mouse event sequence on `payload.quiz.options[payload.result.chosenIndex].element`.

---

### 3.2. Configuration (`src/config/`)

- **`store.ts`**: Consolidates `config.ts` and `config.service.ts` into a single, cohesive `ConfigStore`:
  ```ts
  export class ConfigStore {
    private cachedConfig: RinConfig = { ...DEFAULT_CONFIG };

    /**
     * Loads configuration from browser.storage.local.
     * Gracefully falls back to DEFAULT_CONFIG if storage is inaccessible or uninitialized.
     */
    async load(): Promise<RinConfig> {
      try {
        const stored = await browser.storage.local.get('rinConfig');
        this.cachedConfig = {
          ...DEFAULT_CONFIG,
          ...(stored?.rinConfig || {}),
        };
      } catch (err) {
        logger.error('ConfigStore', `Failed to load config from storage: ${(err as Error)?.message ?? err}`);
        this.cachedConfig = { ...DEFAULT_CONFIG };
      }
      return this.cachedConfig;
    }

    /**
     * Persists configuration to browser.storage.local.
     * Transactional: only updates in-memory cache upon confirmed disk write.
     * Rethrows errors so callers (e.g. UI toggles) know the persistence failed.
     */
    async save(newConfig: RinConfig): Promise<void> {
      try {
        await browser.storage.local.set({ rinConfig: newConfig });
        // Transaction complete: update in-memory cache only after successful persistence
        this.cachedConfig = { ...newConfig };
      } catch (err) {
        logger.error('ConfigStore', `Failed to persist config to storage: ${(err as Error)?.message ?? err}`);
        throw err;
      }
    }

    get(): RinConfig {
      return this.cachedConfig;
    }

    subscribe(listener: ConfigChangeListener): () => void {
      const handler = (changes: Record<string, { newValue?: any }>, area: string) => {
        if (area === 'local' && changes.rinConfig) {
          this.cachedConfig = {
            ...DEFAULT_CONFIG,
            ...(changes.rinConfig.newValue || {}),
          };
          listener(this.cachedConfig);
        }
      };
      browser.storage.onChanged.addListener(handler);
      return () => browser.storage.onChanged.removeListener(handler);
    }
  }

  export const configStore = new ConfigStore();
  ```

---

### 3.3. Meeting Lifecycle (`src/meeting/`)

- **`types.ts`**:
  ```ts
  export interface MeetingCallbacks {
    onEnter: (meetingContainer: HTMLElement) => void;
    onLeave: () => void;
  }
  ```
- **`watcher.ts`**: A unified state machine component replacing `waitForMeeting`, `watchMeetingUnmount`, and `MeetingCoordinator`:
  - `start()`: Queries for `SELECTORS.meeting.container` (or observes `#root` / `body`). Once mounted, calls `onEnter(meetingContainer)` and immediately attaches a shallow observer on `meetingContainer.parentElement` to detect unmount.
  - `handleLeave()`: Calls `onLeave()`, cleans up unmount observer, and immediately re-arms by calling `start()` to wait for the next lecture session in the same browser tab.
  - `stop()`: Disconnects all active observers and resets container references.

---

### 3.4. Quiz Extraction & Observation (`src/quiz/`)

- **`types.ts`**:
  ```ts
  export interface DetectedOption {
    label: string;
    text: string;
    index: number;
    element: HTMLElement; // Eliminates parallel arrays!
  }

  export interface QuizData {
    question: string;
    options: DetectedOption[];
    containerElement: HTMLElement;
    alreadyAnswered: boolean;
    detectedAt: number;
    rawHtml: string;
  }

  export interface QuizObserverCallbacks {
    onQuiz: (quiz: QuizData) => void;
  }
  ```

- **`extractor.ts`**: Decomposed into single-responsibility pure functions:
  - `normalizeWhitespace(text)`: Collapses multiple spaces and trims.
  - `extractBlockText(node)`: Preserves whitespace/indentation for `<pre>`/`<code>` blocks, normalizes whitespace for paragraphs.
  - `parseQuestion(root)`: Extracts markdown description text block-by-block.
  - `parseOption(node, index)`: Extracts label, option text, index, and binds the raw `element`.
  - `extractQuiz(container)`: Finds `div.m-quiz`, parses question and options, runs explicit hydration guard (`question.length > 0 && options.some(opt => opt.text.length > 0)`), and returns `QuizData | null`.

- **`observer.ts`**: Symmetrical with `MeetingWatcher`:
  - Constructor takes `QuizObserverCallbacks`.
  - `start(meetingContainer: HTMLElement)`: Fast-paths if a hydrated quiz is already present, then attaches a `MutationObserver` on `meetingContainer` with `{ childList: true, subtree: true, characterData: true }`. Calls `callbacks.onQuiz(quizData)` when a fully hydrated quiz is extracted.
  - `stop()`: Disconnects the observer and clears references.

- **`workflow.ts`**: Pure pipeline coordinator:
  - Orchestrates: `guard (!enabled || alreadyAnswered) -> solver.solve(...) -> actor.act(...)`.
  - Free of inline `import.meta.env.DEV` checks or file downloading logic. Diagnostic hooks are exposed via optional constructor callbacks (`onQuizProcessed?: (quiz: QuizData) => void`).

---

### 3.5. Messaging & Background Routing (`src/messaging/` & `src/entrypoints/background.ts`)

- **`types.ts`**:
  ```ts
  export interface MessagePayloads {
    SOLVE_QUIZ: QuizInput;
    GET_CONFIG: void;
    LOG: LogPayload;
  }

  export type MessageType = keyof MessagePayloads;

  export type ContentMessage =
    | { type: 'SOLVE_QUIZ'; payload: QuizInput }
    | { type: 'GET_CONFIG' }
    | { type: 'LOG'; payload: LogPayload };

  export type BackgroundResponse =
    | { type: 'QUIZ_SOLVED'; payload: SolveResult }
    | { type: 'CONFIG'; payload: RinConfig }
    | { type: 'ACK' }
    | { type: 'ERROR'; payload: { message: string } };
  ```

- **`router.ts`**: OCP-compliant message registry with automatic payload type inference:
  ```ts
  export type MessageHandler = (payload: any) => Promise<BackgroundResponse>;

  export class MessageRouter {
    private handlers = new Map<MessageType, MessageHandler>();

    /**
     * Registers a message handler with automatic payload type inference.
     * TypeScript maps `type: K` directly to `payload: MessagePayloads[K]`.
     */
    register<K extends MessageType>(
      type: K,
      handler: (payload: MessagePayloads[K]) => Promise<BackgroundResponse>
    ): this {
      this.handlers.set(type, handler);
      return this;
    }

    listen() {
      return (message: unknown, _sender: unknown, sendResponse: (res: BackgroundResponse) => void): boolean => {
        const msg = message as ContentMessage;
        if (!msg || !msg.type) return false;

        const handler = this.handlers.get(msg.type);
        if (!handler) return false;

        const payload = 'payload' in msg ? msg.payload : undefined;

        handler(payload)
          .then((response) => sendResponse(response))
          .catch((err) => {
            sendResponse({
              type: 'ERROR',
              payload: { message: err?.message ?? String(err) },
            });
          });

        return true; // Keep channel open for async response
      };
    }
  }
  ```

- **`background.ts`**:
  ```ts
  export default defineBackground(() => {
    logger.info('Background', 'Rin service worker initialized');
    const solver = new WorkerClient();

    // Handlers automatically infer their exact payload types from the route string!
    const router = new MessageRouter()
      .register('LOG', async (payload) => {
        prettyPrintLog(payload);
        return { type: 'ACK' };
      })
      .register('GET_CONFIG', async () => {
        const config = await configStore.load();
        return { type: 'CONFIG', payload: config };
      })
      .register('SOLVE_QUIZ', async (payload) => {
        const config = await configStore.load();
        const model = import.meta.env.DEV && config.model ? config.model : payload.model;
        const result = await solver.solve({ ...payload, model });
        return { type: 'QUIZ_SOLVED', payload: result };
      });

    browser.runtime.onMessage.addListener(router.listen());
  });
  ```

---

### 3.6. Popup Controller (`src/entrypoints/popup/main.ts`)

- Refactored into a clear, structured module:
  - `PopupView`: Selects and updates UI elements (`updateMode(mode)`, `updateModel(model)`, `updateEnabled(enabled)`).
  - `PopupController`: Connects `ConfigStore` with DOM events, eliminating raw procedural script sprawl.

---

### 3.7. Diagnostics (`src/diagnostics/`)

- **`recorder.ts`**: Encapsulates `captureRootHtml()`, `formatDownloadableHtml()`, `triggerSnapshotDownload()`, and snapshot persistence.
- **`hotkeys.ts`**: Encapsulates the `Alt+Shift+S` / `Ctrl+Alt+S` event listener and cleanup function.
- Completely isolated from production code paths.

---

## 4. Testing & Verification Strategy

All 15 existing test suites (124 tests) must pass with zero regressions. Test files will be updated to reflect the new directory structure:

1. `tests/actors.test.ts`: Tests `createActor()`, `HudActor`, `ClickActor`.
2. `tests/config-store.test.ts`: Consolidated tests for `ConfigStore` (load, save, subscribe). Replaces redundant `config.test.ts` and `config-service.test.ts`.
3. `tests/extractor.test.ts`: Tests `extractQuiz` with `DetectedOption`, whitespace normalization, code block preservation, and hydration guards.
4. `tests/meeting-watcher.test.ts`: Tests `MeetingWatcher` lifecycle, enter/unmount, and session re-arming.
5. `tests/quiz-observer.test.ts`: Tests `QuizObserver` hydration detection and fast-paths.
6. `tests/quiz-workflow.test.ts`: Tests `QuizWorkflow` solver delegation and actor execution.
7. `tests/message-router.test.ts`: Unit tests for `MessageRouter` handling async responses, errors, and missing handlers.
8. `tests/entrypoints.test.ts`: Tests for background and content script composition roots.

---

## 5. Execution Guardrails

- **Zero Regressions**: `pnpm test` (all 124+ tests) must pass cleanly.
- **Zero Type Errors**: `pnpm typecheck` must pass with 0 errors across `@rin/shared`, `@rin/worker`, and `@rin/extension`.
- **No Push**: `git push` will strictly NOT be executed.
