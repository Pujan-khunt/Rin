# Building Rin and preparing reviewer artifacts

The browser extension is built from `packages/extension` using WXT and Vite. `packages/shared` supplies TypeScript contracts; `packages/worker` is a separately deployed Cloudflare Worker and is not bundled into the extension.

## Environment

The build verification environment uses Node.js **22.23.2**, pnpm **12.6.0**, WXT **0.21.4**, and the committed `pnpm-lock.yaml`. WXT and Wrangler require Node.js 22 or newer. Commands below use Bash syntax; in PowerShell set `$env:RIN_CLIENT_KEY = 'test-build-key'` before running the pnpm commands without the inline assignment.

From the repository root:

```bash
pnpm install --frozen-lockfile
```

The extension's `postinstall` script runs `wxt prepare` to generate ambient types. The workspace build policy allows the esbuild, sharp, and workerd dependency build scripts.

## Build and package

An extension build must have a client key. `RIN_CLIENT_KEY` takes precedence over the supported fallback `VITE_RIN_CLIENT_KEY`. This value is compiled into the bundle, so changing it changes the artifact. The dummy key below is suitable for build review; solver requests require the key configured on the deployed worker.

### Chrome

```bash
RIN_CLIENT_KEY="test-build-key" pnpm build
RIN_CLIENT_KEY="test-build-key" pnpm --filter @rin/extension zip
```

The root `build` script invokes workspace build scripts. Only the extension currently defines one, producing the Chrome Manifest V3 bundle.

### Firefox

```bash
RIN_CLIENT_KEY="test-build-key" pnpm --filter @rin/extension build:firefox
RIN_CLIENT_KEY="test-build-key" pnpm --filter @rin/extension zip:firefox
```

### Both browser archives

```bash
RIN_CLIENT_KEY="test-build-key" pnpm --filter @rin/extension zip:all
```

This command runs Chrome packaging followed by Firefox packaging. Firefox packaging also creates a sources archive rooted at the monorepo. It includes the root package manifest, lockfile, workspace configuration, base TypeScript configuration, extension source/assets/configuration, shared package, worker source/configuration, and build instructions. WXT excludes tests; the explicit source allowlist excludes local secrets, dependencies, and generated files.

## Artifact locations

All paths are relative to the repository root and use the current extension version, `0.2.1`:

| Artifact | Path |
|---|---|
| Chrome bundle | `packages/extension/.output/chrome-mv3/` |
| Chrome manifest | `packages/extension/.output/chrome-mv3/manifest.json` |
| Chrome archive | `packages/extension/.output/rinextension-0.2.1-chrome.zip` |
| Firefox bundle | `packages/extension/.output/firefox-mv3/` |
| Firefox manifest | `packages/extension/.output/firefox-mv3/manifest.json` |
| Firefox archive | `packages/extension/.output/rinextension-0.2.1-firefox.zip` |
| WXT sources archive | `packages/extension/.output/rinextension-0.2.1-sources.zip` |

Use the actual names printed by WXT if the extension name or version changes.

To rebuild from the WXT sources archive, extract it to a new directory and run these commands from that directory:

```bash
pnpm install --frozen-lockfile
RIN_CLIENT_KEY="test-build-key" pnpm --filter @rin/extension build:firefox
```

Use the original client key to reproduce the submitted binary. This archive contains build sources; use the full committed archive below when tests and other repository files are also needed.

For a separate archive of the entire committed monorepo, run this after committing the intended source snapshot:

```bash
git archive --format=zip --output=/tmp/rin-sources.zip HEAD
```

`git archive` includes tracked files from `HEAD`, including the lockfile, shared package, and worker source. It excludes uncommitted edits, ignored files, dependencies, and generated build artifacts. The client key used for the submitted binary must be supplied separately to reproduce that binary; rebuilding with a dummy key does not produce identical bytes.

## Local loading

- **Chrome:** open `chrome://extensions`, enable Developer mode, select **Load unpacked**, and choose `packages/extension/.output/chrome-mv3/`.
- **Firefox:** open `about:debugging#/runtime/this-firefox`, select **Load Temporary Add-on**, and choose the Firefox bundle's `manifest.json`.

The generated manifests use Manifest V3 and include the popup, content script, icons, storage permission, and host permissions. Firefox uses WXT's generated background scripts configuration; Chrome uses a background service worker. The configured Firefox minimum is 140.0, with a Firefox Android minimum of 142.0. Builds validate artifact generation, not live browser or mobile behavior.

## Checks and backend setup

```bash
pnpm test
pnpm typecheck
```

Tests provide mocked runtime and network coverage. Type checking runs across all three packages and regenerates WXT types for the extension.

The extension targets `https://rin-worker.pujankhunt.me/solve` in both development and production. A working solver requires `DEEPSEEK_API_KEY` and a matching `RIN_CLIENT_KEY` on that worker. See the [README](README.md#credentials) for local worker variables, secret setup, and deployment commands. Extension packaging does not deploy the worker or verify upstream model access.
