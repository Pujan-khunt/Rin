# Rin extension — Architecture implementation reference

- **Original refactor design date:** 2026-10-02
- **Reconciled with source:** 2026-10-04
- **Scope:** `packages/extension`
- **Status:** Current implementation reference, with differences from the proposal recorded below

The extension uses domain folders, actor strategies, a message-handler registry, and explicit watcher lifecycle methods. This reference describes the implemented boundaries; it does not claim that every original refactor proposal is complete. See the [system reference](2026-09-25-rin-design.md) for HTTP contracts and known behavior limits, and the [README](../../../README.md) for setup.

## 1. Source map

Paths below are relative to `packages/extension/src/`:

| Module | Responsibility |
|---|---|
| `actors/types.ts` | `Actor`, `ActPayload`, and `'assisted' \| 'auto'` modes. |
| `actors/hud.ts` | Save inline styles, highlight a choice, restore on cleanup. |
| `actors/click.ts` | Five-event synthetic interaction sequence; stateless actor. |
| `actors/factory.ts` | `ACTOR_STRATEGIES` constructor registry and assisted fallback. |
| `config/types.ts` | `RinConfig` and old/new configuration listener contract. |
| `config/defaults.ts` | Enabled assisted mode and default model ID. |
| `config/store.ts` | Local storage, cached settings, and storage-change subscriptions. |
| `dom/selectors.ts` | Scaler selectors, including development-only recorded player. |
| `dom/utils.ts` | Whitespace normalization and self-or-descendant lookup. |
| `meeting/types.ts` | Classroom enter/leave callbacks. |
| `meeting/watcher.ts` | Mount/removal observation and meeting re-arming. |
| `quiz/types.ts` | DOM-bound choices, quiz data, and observer callbacks. |
| `quiz/extractor.ts` | Question/option text parsing, hydration and selection detection. |
| `quiz/observer.ts` | Classroom mutation observation and duplicate suppression. |
| `quiz/workflow.ts` | Enabled/answered guards, solve request, actor execution, hook. |
| `solver/client.ts` | Authenticated worker request with a five-second timeout. |
| `messaging/types.ts` | Typed message/response unions and log payloads. |
| `messaging/messenger.ts` | Promise-based runtime send bridge. |
| `messaging/router.ts` | Typed route registration and async runtime responses. |
| `messaging/logger.ts` | Development log dispatch and console formatting. |
| `diagnostics/recorder.ts` | Snapshot creation, local persistence, and HTML downloads. |
| `diagnostics/hotkeys.ts` | Manual snapshot shortcuts and listener teardown. |
| `entrypoints/background.ts` | Solver construction and message route registration. |
| `entrypoints/drona.content.ts` | Settings, actor/workflow, watchers, diagnostics, teardown. |
| `entrypoints/popup/main.ts` | Module-level DOM bindings, initialization, settings events. |
| `entrypoints/popup/index.html` | Enable toggle, mode buttons, development model controls. |
| `entrypoints/popup/popup.css` | Popup styling. |
| `env.d.ts` | Vite environment types, including injected client key. |

## 2. Composition and ownership

The content entrypoint loads the `configStore` singleton and constructs the initial actor using `createActor()`. It injects that actor, initial settings, `sendToBackground`, and an optional development snapshot hook into `QuizWorkflow`.

A storage subscription first updates workflow settings, then swaps the actor when its mode changes. `setActor()` cleans up the previous actor. Setting `enabled: false` cleans up the current actor; watchers continue running and processing guards skip solving.

`QuizObserver.onQuiz` invokes the workflow. `MeetingWatcher.onEnter` starts quiz observation, and `onLeave` stops it and cleans up the actor. Content-context invalidation unsubscribes settings, stops both watchers, cleans up the actor, and removes the development hotkey listener.

The background constructs `WorkerClient` and registers `LOG`, `GET_CONFIG`, and `SOLVE_QUIZ` routes. `SOLVE_QUIZ` loads settings for every request; in development the stored model takes precedence, while production forwards the workflow payload's model. The popup accesses storage directly rather than using `GET_CONFIG`.

## 3. Lifecycle interfaces

| Component | Start/operation | Stop/cleanup |
|---|---|---|
| `MeetingWatcher` | `start()` finds or awaits a classroom; `getContainer()` exposes it. | `stop()` disconnects observers and clears the container without `onLeave`. |
| `QuizObserver` | `start(container)` resets prior observation, emits an existing quiz, then keeps observing. | `stop()` disconnects and clears container and last-emission identity. |
| `QuizWorkflow` | `process(quiz)` guards, sends, checks the response, then acts. | `cleanup()` delegates to actor cleanup; it does not cancel inference. |
| `Actor` | `act({ quiz, result }): Promise<void>`. | `cleanup(): void`. |
| `ConfigStore` | `load()`, `save(config)`, `get()`, compatibility `getConfig()`. | `subscribe(listener)` returns an unsubscribe function. |
| `MessageRouter` | Chainable `register(type, handler)`, then `listen()` attaches one listener. | No removal method is exposed. |

Meeting search observes `#root`/`body` recursively. During a session, quiz observation watches the classroom subtree and removal observation watches its parent, usually shallowly. There is no single-observer guarantee or URL-route filter.

## 4. Quiz representation and execution

A `DetectedOption` owns `{ label, text, index, element }`, avoiding index-aligned arrays in the actor path. `QuizData` also retains optional `optionElements`, which the extractor still fills for compatibility.

Question parsing preserves internal `<pre>` whitespace after trimming. Other blocks and option texts are normalized. Extraction requires at least one option with text; it does not guarantee complete option hydration. Already-answered state is a snapshot of `.choice--selected` presence at extraction time.

The observer deduplicates by element reference and question text. It observes child-list and text mutations, not attribute changes, and ignores option-only differences when determining whether to emit.

The workflow sends only serializable question/options/model data. It catches errors and skips actors for `ERROR` or unexpected responses. After solving it checks current enablement and quiz connectivity. It does not verify that the question is unchanged, every option is connected, the student has not answered meanwhile, or time remains. Actor mode is resolved through the workflow's current actor at execution time.

The assisted actor stores and restores full inline CSS on the chosen element and its descendants. The auto actor dispatches pointer/mouse events and performs no acceptance check. Invalid option indexes are ignored by either actor.

## 5. Configuration and popup

`RinConfig` contains `enabled`, `actorMode`, and optional `model`. Settings persist at `rinConfig` in `browser.storage.local`. `load()` merges stored values over defaults and catches read failures. `subscribe()` publishes both the new configuration and the previous cached value for local `rinConfig` changes.

`save()` replaces the cache after an awaited write and rethrows failures, but `load()` and `get()` return mutable references. The procedural popup mutates its loaded configuration before saving and updates mode/model visuals immediately. Consequently failed writes can leave cache and popup state ahead of persisted storage. There is no `PopupView`/`PopupController` class, rollback, or popup storage-change subscription.

Model preset IDs are `deepseek/deepseek-v4-flash` and `google/gemini-2.5-flash`. A custom field trims its input and falls back to DeepSeek when empty. Production removes these controls but retains stored model values in configuration.

## 6. Routing and dependency boundaries

The actor factory uses a mode-to-constructor registry. Both actors implement the same small interface. The workflow accepts an injected actor, configuration, solver sender, and optional processed hook. Worker-side inference has its own injectable `InferenceClient` interface.

`MessageRouter.register<K>()` maps message names to their payload types at compile time. The internal registry stores a broadly typed handler, and runtime messages are cast rather than schema-validated. `listen()` attaches the browser listener, passes only payload to a recognized handler, returns `true` for async handling, and converts synchronous/rejected errors to `ERROR`. Unknown messages return false. It does not validate senders or remove its listener.

These boundaries support extension through actor and route registration. Some dependencies remain concrete: entrypoints use the config singleton, and `ConfigStore`/`WorkerClient` access global browser/fetch APIs. Several tests spy on prototypes or module exports. The codebase does not implement universal constructor injection or runtime schema enforcement.

## 7. Development diagnostics

The content entrypoint gates diagnostics with `import.meta.env.DEV`. The workflow itself has no development branch: its optional processed hook records the quiz after an actor resolves. Automatic recording stores metadata, raw quiz HTML, and current root HTML under `rinSnapshots`, with no automatic download or retention cap. Storage errors are swallowed.

`Alt+Shift+S` and `Ctrl+Alt+S` create manual root/body snapshots, trigger a Blob download, and attempt storage persistence. Recorder functions themselves are callable in any environment; their normal entrypoint wiring is development-only.

Normal logger calls are silent in production. Development logs use the background console, with runtime forwarding from content/popup contexts. The `LOG` background route still directly calls the printer. No benchmark integration or persisted production quiz history is implemented.

## 8. Differences from the original proposal

| Original intent | Current implementation |
|---|---|
| Unified configuration with zero state drift | Unified store exists; mutable references and popup writes prevent a general transactional guarantee. |
| Eliminate parallel option arrays | Actor access uses `.element`; optional `optionElements` remains populated. |
| Separate popup view and controller | Popup is a procedural module with UI helper functions. |
| Router callback registered by the background | `MessageRouter.listen()` registers the runtime callback itself. |
| Isolate diagnostic code | Entry points gate hooks/hotkeys; recording runs after action, and ordinary production logger dispatch returns early. |
| Symmetrical watcher cleanup | Implemented start/stop methods; ancestor removal and in-flight requests retain the limits described above. |

The old folder names and sample implementations have been removed from this maintained reference. Local implementation plans under `docs/superpowers/plans/` are ignored by Git and should be treated as historical proposals, not instructions to rerun the refactor.

## 9. Verification

Run from the repository root:

```bash
pnpm test
pnpm typecheck
```

Extension suites cover actors, configuration, DOM utilities, extractor, meeting watcher, quiz observer, workflow, worker client, router, messenger, logger, recorder/hotkeys, entrypoints, and popup. Worker suites cover HTTP/solving and answer parsing. Tests use mocked WebExtension/network APIs and JSDOM configured through `vitest.setup.ts` and `vitest.config.ts`. The full suite's current result is reported by Vitest rather than a fixed historical test count.

For production builds and packaging, use [BUILD.md](../../../BUILD.md). Those checks establish compilation and artifact generation; live Scaler interactions, model availability, accuracy, and latency require separate runtime verification.
