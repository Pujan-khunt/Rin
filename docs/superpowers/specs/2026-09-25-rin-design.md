# Rin — Classroom Assistant for Scaler (Drona)
## System Architecture & Technical Design Specification

* **Date**: 2026-09-25
* **Author**: Pujan
* **Status**: Draft / Ready for Implementation Review

---

## 1. Executive Summary & Product Identity

**Rin** is an intelligent, low-latency browser assistant designed for students attending live online classes on Scaler's proprietary meeting platform (**Drona**). During live sessions, instructors conduct periodic, fast-paced quizzes (often 30 seconds or less) to gauge comprehension.

Rin operates **primarily as an assistant**:
1. **Assisted Mode (Default)**: Detects pop-up quizzes in real-time, infers the most accurate answer via an edge AI proxy, and non-intrusively highlights the recommended option with a soft background tint (`#e8d5f5`) directly on the screen. The student retains full agency to verify and click.
2. **Autonomous Mode (Optional / Configurable)**: For users desiring hands-free participation, Rin can be toggled to automatically dispatch user-like click events to submit the recommended option instantly.

### Core Tenets
- **Assistant-First**: Designed as an educational aid and cognitive accelerator, not an intrusive bot.
- **Strict Meeting Scoping**: Zero overhead when browsing courses or dashboard; activates only within an active Drona classroom session.
- **Low-Latency Edge Proxy**: Calls to the AI inference provider are mediated by a zero-cost, edge-deployed Cloudflare Worker to protect API credentials and maintain sub-100ms decision roundtrips.
- **Liskov & SOLID Architecture**: Modular codebase where DOM selectors, observation engines, AI clients, and UI actors communicate strictly through abstractions.

---

## 2. Repository Architecture: pnpm Monorepo

The project is structured as a pnpm workspace housed in a single git repository. This structure enables strict compile-time type sharing between the browser extension and the edge worker without code duplication or npm publishing overhead.

```
rin/
├── packages/
│   ├── extension/               # Browser extension (WXT + Vite)
│   │   ├── src/
│   │   │   ├── config/          # Centralized selectors & local storage
│   │   │   │   ├── selectors.ts # 🎯 SINGLE SOURCE OF TRUTH for all DOM keys
│   │   │   │   └── config.ts    # User settings storage
│   │   │   ├── interfaces/      # Extension-specific runtime interfaces
│   │   │   ├── detection/       # Drona lifecycle & targeted DOM observer
│   │   │   │   ├── lifecycle.ts # Drona meeting session gatekeeper
│   │   │   │   ├── observer.ts  # Targeted MutationObserver (parent container only)
│   │   │   │   ├── extractor.ts # DOM -> QuizData normalizer
│   │   │   │   └── recorder.ts  # [DEV-ONLY] DOM snapshot & freeze capture tool
│   │   │   ├── actors/          # Execution handlers
│   │   │   │   ├── hud-actor.ts # Default: Soft background highlight (#e8d5f5)
│   │   │   │   └── click-actor.ts# Optional: Synthetic pointer click dispatcher
│   │   │   ├── solver/          # Worker communication client
│   │   │   │   └── worker-client.ts
│   │   │   ├── messaging/       # Type-safe background <-> content bridges
│   │   │   └── entrypoints/     # WXT Composition Roots
│   │   │       ├── background.ts# Service worker (HTTP relay)
│   │   │       ├── drona.content.ts # Injected classroom script
│   │   │       └── popup/       # Minimal popup UI (Assistant vs Auto toggle)
│   │   ├── wxt.config.ts        # WXT cross-browser bundler config
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── worker/                  # Cloudflare Worker edge proxy
│   │   ├── src/
│   │   │   ├── index.ts         # Edge handler & AI inference caller
│   │   │   └── providers/       # Benchmark winner AI implementation
│   │   ├── wrangler.jsonc       # Cloudflare Workers configuration
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── shared/                  # Shared TypeScript contracts & models
│       ├── src/
│       │   ├── quiz.ts          # QuizInput, QuizOption
│       │   ├── solver.ts        # SolveResult
│       │   └── index.ts
│       ├── package.json         # Package name: "@rin/shared"
│       └── tsconfig.json
│
├── tools/                       # Dev-only benchmarking & calibration
│   └── benchmark.ts             # Offline CLI evaluator for Jev vs Gemini vs DeepSeek
│
├── test-fixtures/               # 17+ real Scaler quiz HTML snapshots
│   ├── cpp-for-hft/
│   └── financial-markets-and-instruments/
│
├── pnpm-workspace.yaml
├── package.json                 # Monorepo root devDependencies
└── tsconfig.base.json
```

---

## 3. Strict Drona Meeting Lifecycle & Targeted Observation

### 3.1 Complementary Observer State Machine
Scaler.com is a React Single-Page Application (SPA). Navigations between the dashboard, course directory, and live classrooms happen via client-side routing (`history.pushState`) without full page reloads.

To be route-agnostic while eliminating DOM observation overhead, Rin implements a **Mutually Exclusive, Complementary State Machine**: exactly **one** MutationObserver is active at any time.

```
                  ┌───────────────────────────────┐
                  │ State A: MEETING_SEARCH       │
                  │ - Attached to: #root          │
                  │ - Watching for: .vp-container │
                  │ - Quiz Observer: INACTIVE     │
                  └──────────────┬────────────────┘
                                 │
                                 │ React mounts .vp-container
                                 ▼ (Handover: Disconnect Meeting Observer)
                  ┌───────────────────────────────┐
                  │ State B: QUIZ_MONITOR         │
                  │ - Attached to: .vp-container  │
                  │ - Watching for: div.m-quiz    │
                  │ - Meeting Observer: INACTIVE  │
                  └──────────────┬────────────────┘
                                 │
                                 │ .vp-container unmounts (leave class)
                                 ▼ (Teardown: Disconnect Quiz Observer)
                  Return to State A: MEETING_SEARCH
```

### 3.2 Drona Session Gatekeeper (`lifecycle.ts`)
1. **Route-Agnostic Operation**: No fragile URL path filters or regexes. Because `#root` is the permanent React root element across the entire Scaler SPA, watching `#root` for `.vp-container` reliably catches live classes, masterclasses, and recorded archives regardless of how the user navigated there.
2. **Fast-Path Check**: When the content script loads, it immediately queries `#root` for `.vp-container`. If already present (e.g. hard reload during an ongoing class), it jumps directly to State B (`QUIZ_MONITOR`).
3. **Reactive Stage 1 Watcher**: If `.vp-container` is not present, an observer attaches directly to `document.getElementById('root')` with `{ childList: true, subtree: true }`. The exact microtask React renders `.vp-container`, this observer **immediately disconnects itself** and transitions to State B.
4. **Targeted Stage 2 Watcher**: Stage 2 attaches strictly to `.vp-container` with `{ childList: true, subtree: false }`. It observes only direct children of the video player, listening specifically for `div.m-quiz` with zero noise from React chat, participant lists, or controls.
5. **Teardown & Re-Arm**: If the student leaves the class and `.vp-container` is removed from the DOM, the Stage 2 quiz observer cleans up and re-arms State 1 to await the next class.

---

## 4. Centralized Selectors: Single Source of Truth

To ensure Rin is immune to breaking updates and that future DOM schema tweaks require modifying only one file, all selectors are isolated in `packages/extension/src/config/selectors.ts`:

```typescript
// packages/extension/src/config/selectors.ts

export const SELECTORS = {
  app: {
    /** The permanent React application root container for the Scaler SPA */
    root: '#root',
  },
  meeting: {
    /** The parent video player container hosting the meeting and overlays */
    container: '.vp-container',
  },
  quiz: {
    /** Root container of the quiz overlay */
    root: 'div.m-quiz',
    /** Header / Title element */
    title: 'h1.dark.bold',
    /** Problem statement container (Markdown renderer) */
    questionMarkdown: '.m-problem-description__markdown',
    /** List wrapping all option cards */
    choicesList: '.m-problem-choices__list',
    /** Clickable individual choice anchors */
    choiceItem: '.m-problem-choices__list > a.choice',
    /** Choice label indicator (e.g. "A", "B", "C", "D") */
    choiceLabel: '.choice__name',
    /** Choice text content container */
    choiceText: '.choice__text',
  },
} as const;

export type Selectors = typeof SELECTORS;
```

---

## 5. Normalized Data Contracts (`@rin/shared`)

### 5.1 Shared Data Models
Data exchanged between Content Script, Background Worker, and the Edge Proxy:

```typescript
// packages/shared/src/quiz.ts

export interface QuizOption {
  label: string; // e.g. "A", "B", "C", "D"
  text: string;  // Plaintext of the choice
  index: number; // 0-indexed position
}

export interface QuizInput {
  question: string;
  options: Array<{ label: string; text: string }>;
}
```

```typescript
// packages/shared/src/solver.ts

export interface SolveResult {
  chosenIndex: number;          // 0-indexed selected option
  chosenLabel: string;          // "A", "B", "C", or "D"
  confidence: number | null;    // Probability (0.0 - 1.0) if reported by model
  source: string;               // e.g. "jev", "gemini-flash"
  latencyMs: number;            // End-to-end inference latency
}
```

### 5.2 Internal Extension Model (`packages/extension`)
```typescript
// packages/extension/src/interfaces/quiz.ts
import type { QuizOption } from '@rin/shared';

export interface QuizData {
  question: string;
  options: QuizOption[];
  optionElements: HTMLElement[];
  containerElement: HTMLElement;
  rawHtml: string;
  detectedAt: number;
}
```
*(Note: `timeLeftSeconds` has been omitted to keep the extraction pipeline strictly lean and decoupled from timer UI representations).*

---

## 6. Actor Pipeline & UI Presentation

The execution layer follows the Strategy Pattern via the `Actor` interface.

```typescript
// packages/extension/src/interfaces/actor.ts
import type { QuizData } from './quiz';
import type { SolveResult } from '@rin/shared';

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

### 6.1 Default: `HudActor` (Assisted Mode)
- **Goal**: Present the recommendation without hijacking control.
- **Action**: 
  1. Locates the DOM anchor element matching `result.chosenIndex`.
  2. Applies a soft light-purple background:
     ```css
     background-color: #e8d5f5 !important;
     transition: background-color 0.2s ease-in-out;
     ```
  3. Records the previous inline style and restores it during `cleanup()` (triggered when the quiz modal unmounts or session ends).

### 6.2 Optional: `ClickActor` (Autonomous Mode)
- **Goal**: Autonomous one-click submission.
- **Action**: Dispatches a realistic synthetic pointer and mouse sequence to satisfy React event listener bindings:
  ```typescript
  const target = payload.quiz.optionElements[payload.result.chosenIndex];
  const opts = { bubbles: true, cancelable: true, view: window, button: 0 };
  target.dispatchEvent(new PointerEvent('pointerdown', opts));
  target.dispatchEvent(new MouseEvent('mousedown', opts));
  target.dispatchEvent(new PointerEvent('pointerup', opts));
  target.dispatchEvent(new MouseEvent('mouseup', opts));
  target.dispatchEvent(new MouseEvent('click', opts));
  ```

---

## 7. Edge AI Proxy: Cloudflare Worker (`packages/worker`)

### 7.1 Architecture & Security
- **No Embedded Client Secrets**: The browser extension bundle contains zero AI API tokens.
- **Free-Tier Limits**: Runs on Cloudflare Workers (100,000 requests/day, 10ms CPU allowance).
- **Execution Cost**: Routing and forwarding consumes $\approx 0.5\text{ms}$ CPU time; network waiting for AI inference does not count toward CPU quota.
- **Secrets Management**: Credentials (`OPENROUTER_API_KEY`) are stored via encrypted Cloudflare Secrets (`wrangler secret put OPENROUTER_API_KEY`).

### 7.2 Endpoint Definition
- `POST /solve`
  - Accepts `QuizInput` payload.
  - Dispatches the request to the pre-calibrated production inference provider.
  - Returns `SolveResult` with CORS headers allowing extension origins.

---

## 8. Development & Calibration Tools

### 8.1 Offline Benchmark & Calibration Tool (`tools/benchmark.ts`)

A standalone Node.js CLI tool (`tools/benchmark.ts`) executes outside the extension bundle to benchmark candidate models against the 17 verified test fixtures in `test-fixtures/`:

#### Candidate Models Evaluated
1. **TypeSafe AI Jev (`jev-latest`)**: Low-latency System 1 classification using typed `choice` criteria.
2. **Google Gemini 2.5 Flash**: Zero-shot high-speed multimodal LLM.
3. **DeepSeek / OpenAI GPT-4o-mini**: Fast reasoning/comprehension alternatives.

#### Evaluation Criteria
- **Accuracy**: Percentage of correct answers on Scaler quizzes.
- **Decision Latency**: Target $< 500\text{ms}$ overall.
- **Stability**: Zero unhandled exceptions or malformed output formats.

The winning model from the benchmark is deployed as the single production engine in `packages/worker/src/index.ts`.

### 8.2 In-Browser DOM Snapshot Recorder (`recorder.ts`)

During development, verifying whether live Drona meeting quizzes have any subtle DOM differences from recorded class replays is critical. Rin includes a dedicated development recorder (`packages/extension/src/detection/recorder.ts`):

- **Activation**: Conditionally bundled and initialized only during development (`if (import.meta.env.DEV)`). In production builds (`pnpm build`), Vite evaluates the flag to `false` and dead-code-eliminates the recorder entirely.
- **Trigger**: Automatically on quiz detection or manually via a developer hotkey (`Ctrl+Shift+S`).
- **Functionality**:
  1. Grabs the full `outerHTML` of `.m-quiz` and its parent `.vp-container`.
  2. Saves the snapshot with timestamp and current URL into `browser.storage.local`.
  3. Outputs the clean HTML string directly to the DevTools console and triggers a single-click download of `quiz-snapshot-<timestamp>.html`.
- **Purpose**: Enables immediate, stress-free capture of real live class quizzes in the 30-second window for post-class selector verification and fixture generation.

---

## 9. Manifest V3 Configuration

The extension manifest is auto-synthesized by WXT with explicit assistant framing:

```typescript
// packages/extension/wxt.config.ts
import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  browser: 'chrome',
  manifestVersion: 3,
  manifest: {
    name: 'Rin — Classroom Assistant for Scaler',
    description: 'Smart in-class learning assistant that highlights quiz solutions during Scaler Drona sessions.',
    version: '0.1.0',
    permissions: ['storage'],
    host_permissions: ['https://*.scaler.com/*'],
    action: {
      default_title: 'Rin Settings',
    },
  },
});
```

---

## 10. SOLID Principles Compliance Matrix

| Principle | Rin Implementation Architecture |
|---|---|
| **Single Responsibility (SRP)** | `lifecycle.ts` gates sessions; `observer.ts` detects DOM nodes; `extractor.ts` extracts text; `selectors.ts` stores DOM keys; `hud-actor.ts` applies styles. |
| **Open/Closed (OCP)** | New actors (e.g. audio chime actor) or new edge AI models are added by implementing interfaces without touching existing core logic. |
| **Liskov Substitution (LSP)** | `HudActor` and `ClickActor` strictly conform to the `Actor` contract and are hot-swappable at runtime based on user preference. |
| **Interface Segregation (ISP)** | Shared models (`@rin/shared`) isolate serializable data (`QuizInput`, `SolveResult`) from extension DOM nodes (`QuizData`). |
| **Dependency Inversion (DIP)** | Content scripts and background workers depend on abstract `Solver` and `Actor` interfaces; concrete instances are injected at the composition root (`entrypoints/`). |

---

## 11. Verification & Testing Strategy

1. **Selector Integrity Testing**: Automated Vitest suite checking `extractor.ts` against all 17 HTML files in `test-fixtures/`.
2. **Benchmark Verification**: Run `pnpm run benchmark` to record accuracy and response timings across candidate models.
3. **Recorded Replay End-to-End Test**:
   - Load unpacked extension in Chrome/Firefox.
   - Open recorded Scaler class video player.
   - Navigate to quiz timestamp and click "Launch Quiz".
   - Confirm targeted observer triggers within 5ms of `.m-quiz` insertion.
   - Verify `#e8d5f5` styling is accurately applied to the winning option.
   - Verify unmounting cleanly restores element styling.
