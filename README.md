# Rin 🌸

> **Smart in-class AI assistant for Scaler Quizzes.**

Rin is a high-performance, Manifest V3 browser extension engineered to detect, solve, and assist with real-time classroom quizzes on the Scaler (Drona) learning platform. Powered by an ultra-low latency Cloudflare Worker edge AI proxy running on OpenRouter Chat Completions, Rin operates unobtrusively in the background during live lectures.

---

## Architecture & Monorepo Structure

Rin is structured as a strict `pnpm` monorepo:

```
rin/
├── packages/
│   ├── extension/          # Manifest V3 browser extension built with WXT & Vite
│   │   ├── src/
│   │   │   ├── actors/     # Polymorphic execution strategies (HudActor, ClickActor)
│   │   │   ├── config/     # Transactional ConfigStore and settings defaults
│   │   │   ├── diagnostics/# DOM recorder and dev snapshot hotkeys
│   │   │   ├── dom/        # DOM selectors and text extraction helpers
│   │   │   ├── entrypoints/# WXT entrypoints (drona.content.ts, background.ts, popup/)
│   │   │   ├── meeting/    # Symmetrical meeting lifecycle watcher
│   │   │   ├── messaging/  # Type-safe MessageRouter, messenger, and stealth logger
│   │   │   ├── quiz/       # Pure functional quiz extractor, observer, and workflow
│   │   │   └── solver/     # WorkerClient communicating with edge proxy
│   │   └── public/icon/    # Extension icons (16, 32, 48, 128 px)
│   │
│   ├── worker/             # Cloudflare Worker Edge AI proxy endpoint (POST /solve)
│   │   ├── src/index.ts    # OpenRouter Chat Completions inference and request authentication
│   │   └── wrangler.jsonc  # Cloudflare Worker deployment configuration and custom domain route
│   │
│   └── shared/             # Shared TypeScript data contracts and types (@rin/shared)
│       └── src/            # QuizInput, QuizOption, SolveResult, WorkerErrorResponse contracts
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18.0.0 or higher)
- [pnpm](https://pnpm.io/) (v9.0.0 or higher)
- [Cloudflare Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (for worker deployments)

### Installation

Clone the repository and install workspace dependencies:

```bash
git clone https://github.com/Pujan-khunt/Rin.git
cd Rin
pnpm install
```

---

## Configuration & Environment Variables

### 1. Cloudflare Worker (`packages/worker`)

The worker requires two secrets configured in Cloudflare:

| Variable | Description |
|---|---|
| `OPENROUTER_API_KEY` | Upstream API key for OpenRouter Chat Completions. |
| `RIN_CLIENT_KEY` | Shared secret key required in the `X-Rin-Client` request header. |

For local worker development, create `packages/worker/.dev.vars`:
```ini
OPENROUTER_API_KEY="sk-or-v1-..."
RIN_CLIENT_KEY="your-shared-client-secret"
```

For production deployment via Wrangler:
```bash
cd packages/worker
npx wrangler secret put OPENROUTER_API_KEY
npx wrangler secret put RIN_CLIENT_KEY
```

### 2. Browser Extension (`packages/extension`)

The extension strictly requires `RIN_CLIENT_KEY` at build time. If missing, the build will immediately abort:

```bash
export RIN_CLIENT_KEY="your-shared-client-secret"
```

---

## Build & Development Commands

### Browser Extension

```bash
# Build Chrome production bundle with injected client key (.output/chrome-mv3)
RIN_CLIENT_KEY="your-secret" pnpm build

# Run in development mode with live hot-reloading
RIN_CLIENT_KEY="your-secret" pnpm --filter @rin/extension dev

# Run in Firefox development mode
RIN_CLIENT_KEY="your-secret" pnpm --filter @rin/extension dev:firefox

# Build Firefox production bundle (.output/firefox-mv3)
RIN_CLIENT_KEY="your-secret" pnpm --filter @rin/extension build:firefox

# Package Chrome Web Store distribution zip (.output/rinextension-0.1.0-chrome.zip)
RIN_CLIENT_KEY="your-secret" pnpm --filter @rin/extension zip

# Package Firefox AMO distribution zip (.output/rinextension-0.1.0-firefox.zip)
RIN_CLIENT_KEY="your-secret" pnpm --filter @rin/extension zip:firefox

# Package both browser distribution zips
RIN_CLIENT_KEY="your-secret" pnpm --filter @rin/extension zip:all

# Generate clean source code archive for Mozilla Add-on Reviewers
git archive --format=zip --output=rin-sources.zip HEAD
```

### Cloudflare Worker

```bash
# Run local worker dev server (http://localhost:8787)
pnpm --filter @rin/worker dev

# Deploy to Cloudflare Workers (rin-worker.pujankhunt.me)
pnpm --filter @rin/worker deploy
```

---

## Testing & Verification

Run the full automated test suite across all workspace packages:

```bash
pnpm test
```

Run TypeScript strict type checking across all workspace packages:

```bash
pnpm typecheck
```

---

## Loading the Extension Locally

### Chrome / Brave / Edge

1. Run `RIN_CLIENT_KEY="your-secret" pnpm build`.
2. Navigate to `chrome://extensions`.
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select:
   `packages/extension/.output/chrome-mv3`

### Firefox

1. Run `RIN_CLIENT_KEY="your-secret" pnpm --filter @rin/extension build:firefox`.
2. Navigate to `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on...**.
4. Select `packages/extension/.output/firefox-mv3/manifest.json`.

---

## License

This project is licensed under the [MIT License](LICENSE).

