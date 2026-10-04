# Build Instructions for Mozilla Add-on Reviewers

This document provides step-by-step instructions to reproduce the exact build of the **Rin** Firefox extension from this source code archive.

---

## 1. Environment & Prerequisites

- **Operating System**: Linux, macOS, or Windows
- **Node.js**: `v20.x` or later (tested on Node v20/v22)
- **pnpm**: `v9.x` or later (Enable via Corepack: `corepack enable pnpm` or `npm install -g pnpm`)

---

## 2. Project Architecture

This repository is organized as a pnpm monorepo containing:
- `packages/extension`: The WebExtension (built with WXT and Vite).
- `packages/shared`: Shared TypeScript types and interfaces between client and worker.
- `packages/worker`: Cloudflare Worker solver backend (independent package, not bundled into extension).

---

## 3. Build Reproduction Steps

### Step 1: Install Dependencies
From the repository root directory, run:
```bash
pnpm install --frozen-lockfile
```

### Step 2: Build the Firefox WebExtension
From the repository root directory, provide a build-time client key and run:
```bash
RIN_CLIENT_KEY="test-build-key" pnpm --filter @rin/extension build:firefox
```
Or to build and generate the distribution `.zip`:
```bash
RIN_CLIENT_KEY="test-build-key" pnpm --filter @rin/extension zip:firefox
```

---

## 4. Build Artifacts

After running the build command:
- **Unpacked extension**: `packages/extension/.output/firefox-mv3/`
- **Packaged extension zip**: `packages/extension/.output/rinextension-0.1.0-firefox.zip`

The resulting manifest will be located at `packages/extension/.output/firefox-mv3/manifest.json`.
