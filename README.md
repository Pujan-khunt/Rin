# Rin 🌸

> **Smart in-class AI assistant for Scaler Quizzes.**

Rin is a high-performance, Manifest V3 browser extension engineered to detect, solve, and assist with real-time classroom quizzes on the Scaler (Drona) learning platform. Powered by an ultra-low latency Cloudflare Worker edge AI proxy, Rin works unobtrusively in the background during live lectures.

---

## Architecture & Monorepo Structure

Rin is built as a strict `pnpm` monorepo:

```
rin/
├── packages/
│   ├── extension/          # Manifest V3 browser extension built with WXT & Vite
│   │   ├── src/
│   │   │   ├── actors/     # Polymorphic execution strategies (HudActor, ClickActor)
│   │   │   ├── detection/  # DOM extraction, ephemeral lifecycle, and quiz observation
│   │   │   ├── entrypoints/# WXT entrypoints (drona.content.ts, background.ts, popup/)
│   │   │   └── services/   # SOLID domain coordinators (Meeting, QuizWorkflow, Config)
│   │   └── public/icon/    # Extension icons (16, 32, 48, 128 px)
│   │
│   ├── worker/             # Cloudflare Worker Edge AI proxy endpoint (POST /solve)
│   │   └── src/index.ts    # Jev AI inference caller with CORS and payload validation
│   │
│   └── shared/             # Shared TypeScript data contracts and types (@rin/shared)
│       └── src/            # QuizInput, QuizOption, SolveResult contracts
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18.0.0 or higher)
- [pnpm](https://pnpm.io/) (v9.0.0 or higher)

### Installation

Clone the repository and install workspace dependencies:

```bash
git clone https://github.com/Pujan-khunt/Rin.git
cd Rin
pnpm install
```

---

## Development & Commands

### Browser Extension

#### Chrome & Chromium (Brave, Edge)

```bash
# Run in development mode with live hot-reloading
pnpm --filter @rin/extension dev

# Build production bundle (.output/chrome-mv3)
pnpm build

# Package Chrome Web Store zip (.output/rinextension-0.1.0-chrome.zip)
pnpm zip
```

#### Firefox

```bash
# Run in development mode with live hot-reloading in Firefox
pnpm --filter @rin/extension dev:firefox

# Build Firefox production bundle (.output/firefox-mv2)
pnpm build:firefox

# Package Firefox AMO zip and source code archive
pnpm zip:firefox
```

#### Package for All Browsers

```bash
pnpm zip:all
```

---

### Testing & Verification

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

1. Run `pnpm build`.
2. Navigate to `chrome://extensions`.
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select the folder:
   `packages/extension/.output/chrome-mv3`

### Firefox

1. Run `pnpm build:firefox`.
2. Navigate to `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on...**.
4. Select `packages/extension/.output/firefox-mv2/manifest.json` (or the packaged `.zip` file).

---

## License

This project is licensed under the [MIT License](LICENSE).
