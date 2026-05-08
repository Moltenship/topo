# Molten Voice MVP Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the initial local-first Electron desktop dictation foundation for Molten Voice in tiny, resumable increments.

**Architecture:** Start with a pnpm monorepo and a working Electron + React renderer shell, then add typed shared packages, IPC boundaries, local state, model catalog, mock dictation workflows, overlay, setup, settings, and history. Native helper integration is prepared through package boundaries and mockable contracts before real platform helpers are implemented.

**Tech Stack:** pnpm workspaces, Electron, React, Vite, TypeScript, Effect TS, TanStack Router, shadcn/ui-compatible UI structure, Drizzle ORM, SQLite, OxLint, Oxfmt.

---

## Phase 0: Repo Safety And Baseline

### Task 1: Confirm Workspace Baseline

**Files:**
- Read: `AGENTS.md`
- Read: `docs/product-plan.md`
- Read: `docs/architecture-plan.md`

- [ ] **Step 1: Read project instructions**

Run: `Get-Content -Path AGENTS.md`

Expected: Output includes `pnpm run check` completion requirement and conventional commit requirement.

- [ ] **Step 2: Read product plan**

Run: `Get-Content -Path docs\product-plan.md`

Expected: Output includes the local-first desktop dictation MVP scope.

- [ ] **Step 3: Read architecture plan**

Run: `Get-Content -Path docs\architecture-plan.md`

Expected: Output includes Electron Main, React Renderer, services, packages, SQLite, and helper process boundaries.

- [ ] **Step 4: Inspect repository files**

Run: `rg --files`

Expected: Output includes `AGENTS.md`, `docs/product-plan.md`, `docs/architecture-plan.md`, and this plan.

- [ ] **Step 5: Check git status**

Run: `git status --short`

Expected: Either a clean tree or only intentional plan/documentation changes.

If Git reports dubious ownership, run this once outside the plan executor if approved by the user:

```powershell
git config --global --add safe.directory C:/Users/timof.MOLTENSHIP/pgm/molten-voice
```

### Task 2: Create The Minimal Project Metadata

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `.gitignore`
- Create: `.editorconfig`
- Create: `.npmrc`

- [ ] **Step 1: Create root package manifest**

Create `package.json`:

```json
{
  "name": "molten-voice",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@10.11.0",
  "scripts": {
    "check": "pnpm run typecheck && pnpm run fmt && pnpm run lint",
    "typecheck": "pnpm -r run typecheck",
    "fmt": "pnpm -r run fmt",
    "lint": "pnpm -r run lint",
    "dev": "pnpm --filter @molten-voice/desktop dev",
    "build": "pnpm -r run build",
    "test": "pnpm -r run test"
  },
  "devDependencies": {}
}
```

- [ ] **Step 2: Create pnpm workspace file**

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 3: Create gitignore**

Create `.gitignore`:

```gitignore
node_modules
dist
dist-electron
.vite
.turbo
coverage
*.log
*.tsbuildinfo
.env
.env.*
!.env.example
```

- [ ] **Step 4: Create editorconfig**

Create `.editorconfig`:

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true
```

- [ ] **Step 5: Create npm config**

Create `.npmrc`:

```ini
auto-install-peers=true
strict-peer-dependencies=false
```

- [ ] **Step 6: Install initial dependencies**

Run:

```powershell
pnpm add -Dw @typescript/native-preview@beta oxlint oxlint-tsgolint oxfmt vitest
```

Expected: `pnpm-lock.yaml` is created and dev dependencies are added.

- [ ] **Step 7: Commit metadata**

Run:

```powershell
git add package.json pnpm-workspace.yaml .gitignore .editorconfig .npmrc pnpm-lock.yaml
git commit -m "chore: initialize workspace metadata"
```

Expected: Commit succeeds.

## Phase 1: Tooling Foundation

### Task 3: Add Shared TypeScript And Tooling Config

**Files:**
- Create: `tsconfig.base.json`
- Create: `oxlint.json`
- Create: `.oxfmt.json`

- [ ] **Step 1: Create base TypeScript config**

Create `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true
  }
}
```

- [ ] **Step 2: Create OxLint config**

Create `oxlint.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["typescript", "react"],
  "env": {
    "browser": true,
    "node": true,
    "es2023": true
  },
  "rules": {
    "eqeqeq": "error",
    "no-var": "error",
    "prefer-const": "error"
  }
}
```

- [ ] **Step 3: Create OxFormat config**

Create `.oxfmt.json`:

```json
{
  "lineWidth": 100,
  "indentWidth": 2,
  "useTabs": false
}
```

- [ ] **Step 4: Run typecheck**

Run: `pnpm run typecheck`

Expected: Command exits successfully or reports there are no package scripts yet.

- [ ] **Step 5: Commit tooling config**

Run:

```powershell
git add tsconfig.base.json oxlint.json .oxfmt.json
git commit -m "chore: add shared tooling config"
```

Expected: Commit succeeds.

### Task 4: Create Package Skeletons

**Files:**
- Create package folders under `packages/`
- Create package folders under `apps/desktop/`

- [ ] **Step 1: Create package directories**

Run:

```powershell
New-Item -ItemType Directory -Force -Path packages\shared,packages\ui,packages\db,packages\model-catalog,packages\asr,packages\native-bridge,packages\audio,packages\settings,apps\desktop\electron,apps\desktop\renderer,apps\desktop\resources
```

Expected: Directories are created.

- [ ] **Step 2: Create shared package manifest**

Create `packages/shared/package.json`:

```json
{
  "name": "@molten-voice/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsgo --project tsconfig.json --noEmit",
    "fmt": "oxformat --check .",
    "lint": "oxlint .",
    "test": "vitest run",
    "build": "tsgo --project tsconfig.json --noEmit"
  }
}
```

- [ ] **Step 3: Create shared package tsconfig**

Create `packages/shared/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["node"]
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 4: Create shared package source**

Create `packages/shared/src/index.ts`:

```ts
export type Platform = "macos" | "windows";

export const APP_NAME = "Molten Voice";
```

- [ ] **Step 5: Clone the package manifest pattern**

For each package `ui`, `db`, `model-catalog`, `asr`, `native-bridge`, `audio`, and `settings`, create a matching `package.json`, `tsconfig.json`, and `src/index.ts`.

Use package names:

```txt
@molten-voice/ui
@molten-voice/db
@molten-voice/model-catalog
@molten-voice/asr
@molten-voice/native-bridge
@molten-voice/audio
@molten-voice/settings
```

Use this initial source content:

```ts
export const packageReady = true;
```

- [ ] **Step 6: Run workspace typecheck**

Run: `pnpm run typecheck`

Expected: All package typecheck scripts pass.

- [ ] **Step 7: Run workspace formatting check**

Run: `pnpm run fmt`

Expected: Formatting check passes.

- [ ] **Step 8: Run workspace lint**

Run: `pnpm run lint`

Expected: Lint passes.

- [ ] **Step 9: Commit package skeletons**

Run:

```powershell
git add packages apps package.json pnpm-workspace.yaml
git commit -m "chore: add monorepo package skeletons"
```

Expected: Commit succeeds.

## Phase 2: Desktop Shell

### Task 5: Create Electron Desktop Package

**Files:**
- Create: `apps/desktop/package.json`
- Create: `apps/desktop/tsconfig.json`
- Create: `apps/desktop/vite.renderer.config.ts`
- Create: `apps/desktop/electron/main.ts`
- Create: `apps/desktop/electron/preload.ts`
- Create: `apps/desktop/renderer/index.html`
- Create: `apps/desktop/renderer/src/main.tsx`
- Create: `apps/desktop/renderer/src/App.tsx`
- Create: `apps/desktop/renderer/src/styles.css`

- [ ] **Step 1: Install desktop dependencies**

Run:

```powershell
pnpm add --filter @molten-voice/desktop electron @vitejs/plugin-react vite react react-dom @tanstack/react-router effect
pnpm add -D --filter @molten-voice/desktop @types/node @types/react @types/react-dom
```

Expected: Dependencies are installed.

- [ ] **Step 2: Create desktop package manifest**

Create `apps/desktop/package.json`:

```json
{
  "name": "@molten-voice/desktop",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "dist-electron/main.js",
  "scripts": {
    "dev": "vite --config vite.renderer.config.ts",
    "typecheck": "tsgo --project tsconfig.json --noEmit",
    "fmt": "oxformat --check .",
    "lint": "oxlint .",
    "test": "vitest run",
    "build": "vite --config vite.renderer.config.ts build"
  },
  "dependencies": {
    "@molten-voice/shared": "workspace:*"
  }
}
```

- [ ] **Step 3: Create desktop tsconfig**

Create `apps/desktop/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "types": ["node", "vite/client"]
  },
  "include": ["electron/**/*.ts", "renderer/src/**/*.ts", "renderer/src/**/*.tsx", "*.ts"]
}
```

- [ ] **Step 4: Create Vite renderer config**

Create `apps/desktop/vite.renderer.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: "renderer",
  plugins: [react()],
  build: {
    outDir: "../dist/renderer",
    emptyOutDir: true,
  },
});
```

- [ ] **Step 5: Create Electron main placeholder**

Create `apps/desktop/electron/main.ts`:

```ts
import { app, BrowserWindow } from "electron";
import { join } from "node:path";

const createMainWindow = (): BrowserWindow => {
  const window = new BrowserWindow({
    width: 1120,
    height: 760,
    title: "Molten Voice",
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    void window.loadURL(process.env.VITE_DEV_SERVER_URL);
  }

  return window;
};

app.whenReady().then(() => {
  createMainWindow();
});
```

- [ ] **Step 6: Create preload placeholder**

Create `apps/desktop/electron/preload.ts`:

```ts
import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("moltenVoice", {
  appName: "Molten Voice",
});
```

- [ ] **Step 7: Create renderer HTML**

Create `apps/desktop/renderer/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Molten Voice</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 8: Create renderer entry**

Create `apps/desktop/renderer/src/main.tsx`:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 9: Create first app screen**

Create `apps/desktop/renderer/src/App.tsx`:

```tsx
export const App = () => {
  return (
    <main className="app-shell">
      <section className="setup-panel">
        <p className="eyebrow">Local-first dictation</p>
        <h1>Molten Voice</h1>
        <p>Hold a hotkey, speak, and insert private local transcripts into the active app.</p>
      </section>
    </main>
  );
};
```

- [ ] **Step 10: Create initial CSS**

Create `apps/desktop/renderer/src/styles.css`:

```css
:root {
  color: #141414;
  background: #f7f4ef;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

body {
  margin: 0;
}

.app-shell {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 32px;
}

.setup-panel {
  width: min(680px, 100%);
}

.eyebrow {
  margin: 0 0 12px;
  color: #426b58;
  font-size: 14px;
  font-weight: 700;
  text-transform: uppercase;
}

h1 {
  margin: 0 0 16px;
  font-size: 56px;
  line-height: 1;
}

p {
  font-size: 18px;
  line-height: 1.6;
}
```

- [ ] **Step 11: Run desktop typecheck**

Run: `pnpm --filter @molten-voice/desktop run typecheck`

Expected: Typecheck passes.

- [ ] **Step 12: Run desktop build**

Run: `pnpm --filter @molten-voice/desktop run build`

Expected: Renderer build succeeds.

- [ ] **Step 13: Commit desktop shell**

Run:

```powershell
git add apps/desktop package.json pnpm-lock.yaml
git commit -m "feat: add desktop renderer shell"
```

Expected: Commit succeeds.

### Task 6: Add Typed Renderer API Boundary

**Files:**
- Modify: `packages/shared/src/index.ts`
- Modify: `apps/desktop/electron/preload.ts`
- Create: `apps/desktop/renderer/src/env.d.ts`
- Create: `apps/desktop/renderer/src/api/renderer-api.ts`

- [ ] **Step 1: Add shared preload API type**

Modify `packages/shared/src/index.ts`:

```ts
export type Platform = "macos" | "windows";

export interface MoltenVoiceApi {
  readonly appName: string;
}

export const APP_NAME = "Molten Voice";
```

- [ ] **Step 2: Type preload implementation**

Modify `apps/desktop/electron/preload.ts`:

```ts
import { contextBridge } from "electron";
import type { MoltenVoiceApi } from "@molten-voice/shared";

const api: MoltenVoiceApi = {
  appName: "Molten Voice",
};

contextBridge.exposeInMainWorld("moltenVoice", api);
```

- [ ] **Step 3: Add renderer global type**

Create `apps/desktop/renderer/src/env.d.ts`:

```ts
import type { MoltenVoiceApi } from "@molten-voice/shared";

declare global {
  interface Window {
    moltenVoice: MoltenVoiceApi;
  }
}

export {};
```

- [ ] **Step 4: Add renderer API adapter**

Create `apps/desktop/renderer/src/api/renderer-api.ts`:

```ts
import type { MoltenVoiceApi } from "@molten-voice/shared";

export const getRendererApi = (): MoltenVoiceApi => window.moltenVoice;
```

- [ ] **Step 5: Use API in App**

Modify `apps/desktop/renderer/src/App.tsx`:

```tsx
import { getRendererApi } from "./api/renderer-api";

export const App = () => {
  const api = getRendererApi();

  return (
    <main className="app-shell">
      <section className="setup-panel">
        <p className="eyebrow">Local-first dictation</p>
        <h1>{api.appName}</h1>
        <p>Hold a hotkey, speak, and insert private local transcripts into the active app.</p>
      </section>
    </main>
  );
};
```

- [ ] **Step 6: Run typecheck**

Run: `pnpm run typecheck`

Expected: Typecheck passes.

- [ ] **Step 7: Commit typed preload boundary**

Run:

```powershell
git add packages/shared/src/index.ts apps/desktop/electron/preload.ts apps/desktop/renderer/src
git commit -m "feat: add typed renderer api boundary"
```

Expected: Commit succeeds.

## Phase 3: Domain Contracts

### Task 7: Add Shared Dictation Types

**Files:**
- Modify: `packages/shared/src/index.ts`
- Create: `packages/shared/src/dictation.ts`
- Create: `packages/shared/src/errors.ts`
- Create: `packages/shared/src/ipc.ts`

- [ ] **Step 1: Create dictation domain types**

Create `packages/shared/src/dictation.ts`:

```ts
export type RecordingMode = "push-to-talk" | "smart-dictation";
export type StopReason = "hotkey-release" | "silence-timeout" | "manual-cancel";
export type InsertionMode = "paste" | "typing" | "hybrid";
export type InsertionStatus = "inserted" | "failed" | "skipped";
export type OverlayState = "hidden" | "recording" | "processing" | "inserted" | "error";
export type LanguageCode = "en" | "ru" | "auto";

export interface TranscriptRecord {
  readonly id: string;
  readonly text: string;
  readonly createdAt: string;
  readonly durationMs: number;
  readonly modelId: string;
  readonly runtime: string;
  readonly language: LanguageCode;
  readonly recordingMode: RecordingMode;
  readonly stopReason: StopReason;
  readonly insertionMode: InsertionMode;
  readonly insertionStatus: InsertionStatus;
  readonly targetAppName: string | null;
}

export interface LevelFrame {
  readonly sessionId: string;
  readonly timestampMs: number;
  readonly rms: number;
  readonly peak: number;
}
```

- [ ] **Step 2: Create user-safe error types**

Create `packages/shared/src/errors.ts`:

```ts
export type UserErrorCode =
  | "microphone_permission_denied"
  | "hotkey_permission_denied"
  | "input_permission_denied"
  | "model_not_installed"
  | "model_load_failed"
  | "transcription_failed"
  | "insertion_failed"
  | "helper_unavailable"
  | "download_failed"
  | "checksum_failed";

export interface UserFacingError {
  readonly code: UserErrorCode;
  readonly message: string;
}
```

- [ ] **Step 3: Create IPC channel constants**

Create `packages/shared/src/ipc.ts`:

```ts
export const IpcChannels = {
  getAppState: "app:get-state",
  listTranscripts: "history:list-transcripts",
  deleteTranscript: "history:delete-transcript",
  clearTranscripts: "history:clear-transcripts",
  updateSettings: "settings:update",
  startTestDictation: "dictation:start-test",
  stopTestDictation: "dictation:stop-test",
} as const;

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels];
```

- [ ] **Step 4: Export shared modules**

Modify `packages/shared/src/index.ts`:

```ts
export * from "./dictation";
export * from "./errors";
export * from "./ipc";

export type Platform = "macos" | "windows";

export interface MoltenVoiceApi {
  readonly appName: string;
}

export const APP_NAME = "Molten Voice";
```

- [ ] **Step 5: Run shared tests**

Run: `pnpm --filter @molten-voice/shared run test`

Expected: Test command passes with no tests or existing tests.

- [ ] **Step 6: Run typecheck**

Run: `pnpm run typecheck`

Expected: Typecheck passes.

- [ ] **Step 7: Commit shared contracts**

Run:

```powershell
git add packages/shared
git commit -m "feat: add dictation domain contracts"
```

Expected: Commit succeeds.

### Task 8: Add Settings Schema

**Files:**
- Modify: `packages/settings/package.json`
- Modify: `packages/settings/src/index.ts`
- Create: `packages/settings/src/settings-schema.ts`
- Create: `packages/settings/src/settings-schema.test.ts`

- [ ] **Step 1: Install schema dependency**

Run: `pnpm add --filter @molten-voice/settings zod`

Expected: `zod` is added to the settings package.

- [ ] **Step 2: Create settings schema**

Create `packages/settings/src/settings-schema.ts`:

```ts
import { z } from "zod";

export const recordingModeSchema = z.enum(["push-to-talk", "smart-dictation"]);
export const insertionModeSchema = z.enum(["paste", "typing", "hybrid"]);
export const postProcessingModeSchema = z.enum(["raw", "lightweight"]);
export const languageSchema = z.enum(["en", "ru", "auto"]);

export const appSettingsSchema = z.object({
  hotkey: z.string().min(1).default("CapsLock"),
  recordingMode: recordingModeSchema.default("push-to-talk"),
  silenceTimeoutMs: z.union([z.literal(1200), z.literal(1500), z.literal(2000), z.literal(3000)]).nullable().default(null),
  insertionMode: insertionModeSchema.default("paste"),
  postProcessingMode: postProcessingModeSchema.default("lightweight"),
  language: languageSchema.default("auto"),
  historyEnabled: z.boolean().default(true),
  autoDeleteHistoryDays: z.number().int().positive().nullable().default(null),
  modelDirectory: z.string().nullable().default(null),
  activeModelId: z.string().nullable().default(null)
});

export type AppSettings = z.infer<typeof appSettingsSchema>;

export const defaultAppSettings = (): AppSettings => appSettingsSchema.parse({});
```

- [ ] **Step 3: Export settings schema**

Modify `packages/settings/src/index.ts`:

```ts
export * from "./settings-schema";
```

- [ ] **Step 4: Add settings tests**

Create `packages/settings/src/settings-schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { appSettingsSchema, defaultAppSettings } from "./settings-schema";

describe("appSettingsSchema", () => {
  it("creates local-first defaults", () => {
    expect(defaultAppSettings()).toEqual({
      hotkey: "CapsLock",
      recordingMode: "push-to-talk",
      silenceTimeoutMs: null,
      insertionMode: "paste",
      postProcessingMode: "lightweight",
      language: "auto",
      historyEnabled: true,
      autoDeleteHistoryDays: null,
      modelDirectory: null,
      activeModelId: null,
    });
  });

  it("rejects unsupported silence timeout values", () => {
    expect(() => appSettingsSchema.parse({ silenceTimeoutMs: 900 })).toThrow();
  });
});
```

- [ ] **Step 5: Run settings tests**

Run: `pnpm --filter @molten-voice/settings run test`

Expected: Both tests pass.

- [ ] **Step 6: Run check**

Run: `pnpm run check`

Expected: Typecheck, format, and lint pass.

- [ ] **Step 7: Commit settings schema**

Run:

```powershell
git add packages/settings package.json pnpm-lock.yaml
git commit -m "feat: add settings schema"
```

Expected: Commit succeeds.

### Task 9: Add Static Model Catalog

**Files:**
- Modify: `packages/model-catalog/src/index.ts`
- Create: `packages/model-catalog/src/model-catalog.ts`
- Create: `packages/model-catalog/src/model-catalog.test.ts`

- [ ] **Step 1: Create model catalog types and data**

Create `packages/model-catalog/src/model-catalog.ts`:

```ts
export type AsrRuntime = "whisperkit" | "whisper-cpp" | "parakeet";
export type ModelQualityLabel = "fast" | "balanced" | "quality";
export type ModelSpeedLabel = "fastest" | "fast" | "moderate";

export interface ModelCatalogEntry {
  readonly id: string;
  readonly displayName: string;
  readonly runtime: AsrRuntime;
  readonly platforms: readonly ("macos" | "windows")[];
  readonly architectures: readonly string[];
  readonly languages: readonly ("en" | "ru")[];
  readonly downloadUrl: string;
  readonly checksumSha256: string;
  readonly downloadSizeBytes: number;
  readonly diskSizeBytes: number;
  readonly estimatedMemoryBytes: number;
  readonly qualityLabel: ModelQualityLabel;
  readonly speedLabel: ModelSpeedLabel;
  readonly badges: readonly string[];
  readonly experimental: boolean;
}

const gib = 1024 * 1024 * 1024;

export const bundledModelCatalog: readonly ModelCatalogEntry[] = [
  {
    id: "whisperkit-small",
    displayName: "WhisperKit Small",
    runtime: "whisperkit",
    platforms: ["macos"],
    architectures: ["arm64"],
    languages: ["en", "ru"],
    downloadUrl: "https://example.invalid/models/whisperkit-small",
    checksumSha256: "0000000000000000000000000000000000000000000000000000000000000001",
    downloadSizeBytes: Math.round(0.5 * gib),
    diskSizeBytes: Math.round(1.2 * gib),
    estimatedMemoryBytes: Math.round(1.8 * gib),
    qualityLabel: "balanced",
    speedLabel: "fast",
    badges: ["recommended"],
    experimental: false,
  },
  {
    id: "whisper-cpp-small",
    displayName: "Whisper.cpp Small",
    runtime: "whisper-cpp",
    platforms: ["windows"],
    architectures: ["x64", "arm64"],
    languages: ["en", "ru"],
    downloadUrl: "https://example.invalid/models/whisper-cpp-small",
    checksumSha256: "0000000000000000000000000000000000000000000000000000000000000002",
    downloadSizeBytes: Math.round(0.5 * gib),
    diskSizeBytes: Math.round(1.1 * gib),
    estimatedMemoryBytes: Math.round(1.8 * gib),
    qualityLabel: "balanced",
    speedLabel: "fast",
    badges: ["recommended"],
    experimental: false,
  },
  {
    id: "parakeet-tdt-0-6b-v3",
    displayName: "Parakeet TDT 0.6B v3",
    runtime: "parakeet",
    platforms: ["windows"],
    architectures: ["x64"],
    languages: ["en", "ru"],
    downloadUrl: "https://example.invalid/models/parakeet-tdt-0-6b-v3",
    checksumSha256: "0000000000000000000000000000000000000000000000000000000000000003",
    downloadSizeBytes: Math.round(1.5 * gib),
    diskSizeBytes: Math.round(2.5 * gib),
    estimatedMemoryBytes: Math.round(3 * gib),
    qualityLabel: "quality",
    speedLabel: "moderate",
    badges: ["experimental"],
    experimental: true,
  },
];

export const findCatalogModel = (modelId: string): ModelCatalogEntry | undefined =>
  bundledModelCatalog.find((model) => model.id === modelId);
```

- [ ] **Step 2: Export model catalog**

Modify `packages/model-catalog/src/index.ts`:

```ts
export * from "./model-catalog";
```

- [ ] **Step 3: Add model catalog tests**

Create `packages/model-catalog/src/model-catalog.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { bundledModelCatalog, findCatalogModel } from "./model-catalog";

describe("bundledModelCatalog", () => {
  it("contains English and Russian capable models", () => {
    expect(bundledModelCatalog.every((model) => model.languages.includes("en"))).toBe(true);
    expect(bundledModelCatalog.every((model) => model.languages.includes("ru"))).toBe(true);
  });

  it("keeps MVP models within the target memory envelope", () => {
    expect(bundledModelCatalog.every((model) => model.estimatedMemoryBytes <= 3 * 1024 * 1024 * 1024)).toBe(true);
  });

  it("finds models by id", () => {
    expect(findCatalogModel("whisper-cpp-small")?.runtime).toBe("whisper-cpp");
  });
});
```

- [ ] **Step 4: Run model catalog tests**

Run: `pnpm --filter @molten-voice/model-catalog run test`

Expected: Three tests pass.

- [ ] **Step 5: Run check**

Run: `pnpm run check`

Expected: Typecheck, format, and lint pass.

- [ ] **Step 6: Commit model catalog**

Run:

```powershell
git add packages/model-catalog
git commit -m "feat: add static model catalog"
```

Expected: Commit succeeds.

### Task 10: Add Hardware Recommendation Policy

**Files:**
- Create: `packages/model-catalog/src/recommendation.ts`
- Create: `packages/model-catalog/src/recommendation.test.ts`
- Modify: `packages/model-catalog/src/index.ts`

- [ ] **Step 1: Create recommendation policy**

Create `packages/model-catalog/src/recommendation.ts`:

```ts
import type { ModelCatalogEntry } from "./model-catalog";

export interface HardwareProfile {
  readonly platform: "macos" | "windows";
  readonly architecture: string;
  readonly memoryBytes: number;
  readonly hasNvidiaGpu: boolean;
}

export interface ModelRecommendation {
  readonly recommended: ModelCatalogEntry | null;
  readonly eligible: readonly ModelCatalogEntry[];
}

export const recommendModel = (
  catalog: readonly ModelCatalogEntry[],
  hardware: HardwareProfile,
): ModelRecommendation => {
  const eligible = catalog.filter(
    (model) =>
      model.platforms.includes(hardware.platform) &&
      model.architectures.includes(hardware.architecture) &&
      model.estimatedMemoryBytes <= hardware.memoryBytes,
  );

  const stable = eligible.filter((model) => !model.experimental);
  const nvidiaExperimental = eligible.find(
    (model) => hardware.hasNvidiaGpu && model.runtime === "parakeet",
  );

  return {
    recommended: stable[0] ?? nvidiaExperimental ?? eligible[0] ?? null,
    eligible,
  };
};
```

- [ ] **Step 2: Add recommendation tests**

Create `packages/model-catalog/src/recommendation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { bundledModelCatalog } from "./model-catalog";
import { recommendModel } from "./recommendation";

describe("recommendModel", () => {
  it("recommends WhisperKit on Apple Silicon", () => {
    const result = recommendModel(bundledModelCatalog, {
      platform: "macos",
      architecture: "arm64",
      memoryBytes: 8 * 1024 * 1024 * 1024,
      hasNvidiaGpu: false,
    });

    expect(result.recommended?.runtime).toBe("whisperkit");
  });

  it("recommends stable whisper.cpp over experimental Parakeet on Windows", () => {
    const result = recommendModel(bundledModelCatalog, {
      platform: "windows",
      architecture: "x64",
      memoryBytes: 8 * 1024 * 1024 * 1024,
      hasNvidiaGpu: true,
    });

    expect(result.recommended?.runtime).toBe("whisper-cpp");
  });
});
```

- [ ] **Step 3: Export recommendation policy**

Modify `packages/model-catalog/src/index.ts`:

```ts
export * from "./model-catalog";
export * from "./recommendation";
```

- [ ] **Step 4: Run recommendation tests**

Run: `pnpm --filter @molten-voice/model-catalog run test`

Expected: All model catalog tests pass.

- [ ] **Step 5: Commit recommendation policy**

Run:

```powershell
git add packages/model-catalog
git commit -m "feat: add model recommendation policy"
```

Expected: Commit succeeds.

## Phase 4: Local State And History

### Task 11: Add Database Schema

**Files:**
- Modify: `packages/db/package.json`
- Create: `packages/db/src/schema.ts`
- Modify: `packages/db/src/index.ts`

- [ ] **Step 1: Install database dependencies**

Run: `pnpm add --filter @molten-voice/db drizzle-orm better-sqlite3`

Expected: Drizzle and SQLite dependencies are installed.

- [ ] **Step 2: Install database type dependency**

Run: `pnpm add -D --filter @molten-voice/db @types/better-sqlite3`

Expected: SQLite types are installed.

- [ ] **Step 3: Create Drizzle schema**

Create `packages/db/src/schema.ts`:

```ts
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  valueJson: text("value_json").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const installedModels = sqliteTable("installed_models", {
  id: text("id").primaryKey(),
  modelId: text("model_id").notNull(),
  runtime: text("runtime").notNull(),
  directory: text("directory").notNull(),
  checksumSha256: text("checksum_sha256").notNull(),
  installedAt: text("installed_at").notNull(),
});

export const transcripts = sqliteTable("transcripts", {
  id: text("id").primaryKey(),
  text: text("text").notNull(),
  createdAt: text("created_at").notNull(),
  durationMs: integer("duration_ms").notNull(),
  modelId: text("model_id").notNull(),
  runtime: text("runtime").notNull(),
  language: text("language").notNull(),
  recordingMode: text("recording_mode").notNull(),
  stopReason: text("stop_reason").notNull(),
  insertionMode: text("insertion_mode").notNull(),
  insertionStatus: text("insertion_status").notNull(),
  targetAppName: text("target_app_name"),
});

export const insertionEvents = sqliteTable("insertion_events", {
  id: text("id").primaryKey(),
  transcriptId: text("transcript_id").notNull(),
  mode: text("mode").notNull(),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
  errorCode: text("error_code"),
});
```

- [ ] **Step 4: Export schema**

Modify `packages/db/src/index.ts`:

```ts
export * from "./schema";
```

- [ ] **Step 5: Run database typecheck**

Run: `pnpm --filter @molten-voice/db run typecheck`

Expected: Typecheck passes.

- [ ] **Step 6: Commit database schema**

Run:

```powershell
git add packages/db package.json pnpm-lock.yaml
git commit -m "feat: add local database schema"
```

Expected: Commit succeeds.

### Task 12: Add Transcript Repository

**Files:**
- Create: `packages/db/src/transcript-repository.ts`
- Create: `packages/db/src/transcript-repository.test.ts`
- Modify: `packages/db/src/index.ts`

- [ ] **Step 1: Create transcript repository**

Create `packages/db/src/transcript-repository.ts`:

```ts
import { desc, eq, like } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { TranscriptRecord } from "@molten-voice/shared";
import { transcripts } from "./schema";

export interface TranscriptRepository {
  readonly insert: (record: TranscriptRecord) => Promise<void>;
  readonly list: (query?: string) => Promise<readonly TranscriptRecord[]>;
  readonly deleteById: (id: string) => Promise<void>;
  readonly clear: () => Promise<void>;
}

export const createTranscriptRepository = (
  db: BetterSQLite3Database<Record<string, never>>,
): TranscriptRepository => ({
  insert: async (record) => {
    db.insert(transcripts).values(record).run();
  },
  list: async (query) => {
    const rows = query
      ? db.select().from(transcripts).where(like(transcripts.text, `%${query}%`)).orderBy(desc(transcripts.createdAt)).all()
      : db.select().from(transcripts).orderBy(desc(transcripts.createdAt)).all();

    return rows as readonly TranscriptRecord[];
  },
  deleteById: async (id) => {
    db.delete(transcripts).where(eq(transcripts.id, id)).run();
  },
  clear: async () => {
    db.delete(transcripts).run();
  },
});
```

- [ ] **Step 2: Export transcript repository**

Modify `packages/db/src/index.ts`:

```ts
export * from "./schema";
export * from "./transcript-repository";
```

- [ ] **Step 3: Add repository test**

Create `packages/db/src/transcript-repository.test.ts`:

```ts
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { describe, expect, it } from "vitest";
import { transcripts } from "./schema";
import { createTranscriptRepository } from "./transcript-repository";

const createMemoryRepository = () => {
  const sqlite = new Database(":memory:");
  sqlite.exec(`
    CREATE TABLE transcripts (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      duration_ms INTEGER NOT NULL,
      model_id TEXT NOT NULL,
      runtime TEXT NOT NULL,
      language TEXT NOT NULL,
      recording_mode TEXT NOT NULL,
      stop_reason TEXT NOT NULL,
      insertion_mode TEXT NOT NULL,
      insertion_status TEXT NOT NULL,
      target_app_name TEXT
    )
  `);
  return createTranscriptRepository(drizzle(sqlite, { schema: { transcripts } }));
};

describe("createTranscriptRepository", () => {
  it("stores and searches transcript records without audio", async () => {
    const repository = createMemoryRepository();

    await repository.insert({
      id: "tr_1",
      text: "hello molten voice",
      createdAt: "2026-05-07T00:00:00.000Z",
      durationMs: 1200,
      modelId: "whisper-cpp-small",
      runtime: "whisper-cpp",
      language: "en",
      recordingMode: "push-to-talk",
      stopReason: "hotkey-release",
      insertionMode: "paste",
      insertionStatus: "inserted",
      targetAppName: "Test App",
    });

    await repository.insert({
      id: "tr_2",
      text: "privet mir",
      createdAt: "2026-05-07T00:01:00.000Z",
      durationMs: 900,
      modelId: "whisper-cpp-small",
      runtime: "whisper-cpp",
      language: "ru",
      recordingMode: "push-to-talk",
      stopReason: "hotkey-release",
      insertionMode: "paste",
      insertionStatus: "inserted",
      targetAppName: null,
    });

    const results = await repository.list("molten");

    expect(results).toHaveLength(1);
    expect(results[0]?.text).toBe("hello molten voice");
  });
});
```

- [ ] **Step 4: Run database tests**

Run: `pnpm --filter @molten-voice/db run test`

Expected: Repository test passes.

- [ ] **Step 5: Run check**

Run: `pnpm run check`

Expected: Typecheck, format, and lint pass.

- [ ] **Step 6: Commit transcript repository**

Run:

```powershell
git add packages/db
git commit -m "feat: add transcript repository"
```

Expected: Commit succeeds.

## Phase 5: App Workflows And Mock Dictation

### Task 13: Add Post-Processing Service

**Files:**
- Modify: `packages/asr/src/index.ts`
- Create: `packages/asr/src/post-processing.ts`
- Create: `packages/asr/src/post-processing.test.ts`

- [ ] **Step 1: Create transcript normalizer**

Create `packages/asr/src/post-processing.ts`:

```ts
export type PostProcessingMode = "raw" | "lightweight";

export const normalizeTranscript = (text: string, mode: PostProcessingMode): string => {
  if (mode === "raw") {
    return text;
  }

  const normalized = text.trim().replace(/\s+/g, " ").replace(/\s+([,.!?;:])/g, "$1");

  if (normalized.length === 0) {
    return normalized;
  }

  return normalized[0].toLocaleUpperCase() + normalized.slice(1);
};
```

- [ ] **Step 2: Export transcript normalizer**

Modify `packages/asr/src/index.ts`:

```ts
export * from "./post-processing";
```

- [ ] **Step 3: Add normalizer tests**

Create `packages/asr/src/post-processing.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { normalizeTranscript } from "./post-processing";

describe("normalizeTranscript", () => {
  it("keeps raw text unchanged", () => {
    expect(normalizeTranscript("  hello   world  ", "raw")).toBe("  hello   world  ");
  });

  it("trims, collapses whitespace, fixes punctuation spacing, and capitalizes", () => {
    expect(normalizeTranscript("  hello   world  ! ", "lightweight")).toBe("Hello world!");
  });
});
```

- [ ] **Step 4: Run ASR tests**

Run: `pnpm --filter @molten-voice/asr run test`

Expected: Normalizer tests pass.

- [ ] **Step 5: Commit post-processing service**

Run:

```powershell
git add packages/asr
git commit -m "feat: add transcript post-processing"
```

Expected: Commit succeeds.

### Task 14: Add Mock Audio Capture Contract

**Files:**
- Modify: `packages/audio/src/index.ts`
- Create: `packages/audio/src/audio-capture-service.ts`
- Create: `packages/audio/src/mock-audio-capture-service.test.ts`

- [ ] **Step 1: Create audio capture service contract and mock**

Create `packages/audio/src/audio-capture-service.ts`:

```ts
import type { LevelFrame, StopReason } from "@molten-voice/shared";

export interface CapturedAudio {
  readonly sessionId: string;
  readonly audioPath: string;
  readonly durationMs: number;
}

export type Unsubscribe = () => void;

export interface AudioCaptureService {
  readonly startRecording: (sessionId: string) => Promise<void>;
  readonly stopRecording: (reason: StopReason) => Promise<CapturedAudio>;
  readonly onLevelFrame: (listener: (frame: LevelFrame) => void) => Unsubscribe;
}

export const createMockAudioCaptureService = (): AudioCaptureService => {
  let activeSessionId: string | null = null;
  const listeners = new Set<(frame: LevelFrame) => void>();

  return {
    startRecording: async (sessionId) => {
      activeSessionId = sessionId;
      for (const listener of listeners) {
        listener({ sessionId, timestampMs: Date.now(), rms: 0.4, peak: 0.7 });
      }
    },
    stopRecording: async () => {
      if (activeSessionId === null) {
        throw new Error("No active recording session");
      }

      const sessionId = activeSessionId;
      activeSessionId = null;

      return {
        sessionId,
        audioPath: `mock://${sessionId}.wav`,
        durationMs: 1200,
      };
    },
    onLevelFrame: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};
```

- [ ] **Step 2: Export audio capture contract**

Modify `packages/audio/src/index.ts`:

```ts
export * from "./audio-capture-service";
```

- [ ] **Step 3: Add mock audio capture test**

Create `packages/audio/src/mock-audio-capture-service.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createMockAudioCaptureService } from "./audio-capture-service";

describe("createMockAudioCaptureService", () => {
  it("emits a level frame and returns captured audio", async () => {
    const service = createMockAudioCaptureService();
    const frames: unknown[] = [];

    service.onLevelFrame((frame) => frames.push(frame));

    await service.startRecording("session_1");
    const audio = await service.stopRecording("hotkey-release");

    expect(frames).toHaveLength(1);
    expect(audio).toEqual({
      sessionId: "session_1",
      audioPath: "mock://session_1.wav",
      durationMs: 1200,
    });
  });
});
```

- [ ] **Step 4: Run audio tests**

Run: `pnpm --filter @molten-voice/audio run test`

Expected: Mock audio test passes.

- [ ] **Step 5: Commit audio contract**

Run:

```powershell
git add packages/audio
git commit -m "feat: add audio capture contract"
```

Expected: Commit succeeds.

### Task 15: Add Mock Transcription Provider

**Files:**
- Create: `packages/asr/src/transcription-provider.ts`
- Create: `packages/asr/src/transcription-provider.test.ts`
- Modify: `packages/asr/src/index.ts`

- [ ] **Step 1: Create transcription provider contract and mock**

Create `packages/asr/src/transcription-provider.ts`:

```ts
export interface TranscriptionInput {
  readonly audioPath: string;
  readonly language: "en" | "ru" | "auto";
  readonly modelId: string;
}

export interface TranscriptionResult {
  readonly text: string;
  readonly language: "en" | "ru";
  readonly durationInSeconds: number;
  readonly warnings: readonly string[];
}

export interface TranscriptionProvider {
  readonly transcribe: (input: TranscriptionInput) => Promise<TranscriptionResult>;
}

export const createMockTranscriptionProvider = (): TranscriptionProvider => ({
  transcribe: async (input) => ({
    text: input.language === "ru" ? "privet mir" : "hello world",
    language: input.language === "ru" ? "ru" : "en",
    durationInSeconds: 1.2,
    warnings: [],
  }),
});
```

- [ ] **Step 2: Export transcription provider**

Modify `packages/asr/src/index.ts`:

```ts
export * from "./post-processing";
export * from "./transcription-provider";
```

- [ ] **Step 3: Add mock transcription test**

Create `packages/asr/src/transcription-provider.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createMockTranscriptionProvider } from "./transcription-provider";

describe("createMockTranscriptionProvider", () => {
  it("returns deterministic Russian text for Russian input", async () => {
    const provider = createMockTranscriptionProvider();

    await expect(
      provider.transcribe({
        audioPath: "mock://session.wav",
        language: "ru",
        modelId: "whisper-cpp-small",
      }),
    ).resolves.toMatchObject({
      text: "privet mir",
      language: "ru",
    });
  });
});
```

- [ ] **Step 4: Run ASR tests**

Run: `pnpm --filter @molten-voice/asr run test`

Expected: ASR tests pass.

- [ ] **Step 5: Commit mock transcription provider**

Run:

```powershell
git add packages/asr
git commit -m "feat: add mock transcription provider"
```

Expected: Commit succeeds.

### Task 16: Add Dictation Orchestrator

**Files:**
- Create: `packages/asr/src/dictation-orchestrator.ts`
- Create: `packages/asr/src/dictation-orchestrator.test.ts`
- Modify: `packages/asr/src/index.ts`

- [ ] **Step 1: Create orchestrator contract**

Create `packages/asr/src/dictation-orchestrator.ts`:

```ts
import type { AudioCaptureService } from "@molten-voice/audio";
import type { LanguageCode, TranscriptRecord } from "@molten-voice/shared";
import { normalizeTranscript, type PostProcessingMode } from "./post-processing";
import type { TranscriptionProvider } from "./transcription-provider";

export interface DictationOrchestratorDependencies {
  readonly audio: AudioCaptureService;
  readonly transcription: TranscriptionProvider;
  readonly now: () => Date;
  readonly createId: () => string;
}

export interface DictationOrchestrator {
  readonly start: () => Promise<string>;
  readonly stop: (input: {
    readonly language: LanguageCode;
    readonly modelId: string;
    readonly runtime: string;
    readonly postProcessingMode: PostProcessingMode;
  }) => Promise<TranscriptRecord>;
}

export const createDictationOrchestrator = (
  dependencies: DictationOrchestratorDependencies,
): DictationOrchestrator => {
  let sessionId: string | null = null;

  return {
    start: async () => {
      sessionId = dependencies.createId();
      await dependencies.audio.startRecording(sessionId);
      return sessionId;
    },
    stop: async (input) => {
      if (sessionId === null) {
        throw new Error("No active dictation session");
      }

      const audio = await dependencies.audio.stopRecording("hotkey-release");
      const result = await dependencies.transcription.transcribe({
        audioPath: audio.audioPath,
        language: input.language,
        modelId: input.modelId,
      });

      sessionId = null;

      return {
        id: dependencies.createId(),
        text: normalizeTranscript(result.text, input.postProcessingMode),
        createdAt: dependencies.now().toISOString(),
        durationMs: audio.durationMs,
        modelId: input.modelId,
        runtime: input.runtime,
        language: result.language,
        recordingMode: "push-to-talk",
        stopReason: "hotkey-release",
        insertionMode: "paste",
        insertionStatus: "skipped",
        targetAppName: null,
      };
    },
  };
};
```

- [ ] **Step 2: Export orchestrator**

Modify `packages/asr/src/index.ts`:

```ts
export * from "./dictation-orchestrator";
export * from "./post-processing";
export * from "./transcription-provider";
```

- [ ] **Step 3: Add orchestrator test**

Create `packages/asr/src/dictation-orchestrator.test.ts`:

```ts
import { createMockAudioCaptureService } from "@molten-voice/audio";
import { describe, expect, it } from "vitest";
import { createDictationOrchestrator } from "./dictation-orchestrator";
import { createMockTranscriptionProvider } from "./transcription-provider";

describe("createDictationOrchestrator", () => {
  it("records, transcribes, normalizes, and returns a transcript record", async () => {
    const ids = ["session_1", "transcript_1"];
    const orchestrator = createDictationOrchestrator({
      audio: createMockAudioCaptureService(),
      transcription: createMockTranscriptionProvider(),
      now: () => new Date("2026-05-07T00:00:00.000Z"),
      createId: () => ids.shift() ?? "fallback",
    });

    await orchestrator.start();
    const transcript = await orchestrator.stop({
      language: "en",
      modelId: "whisper-cpp-small",
      runtime: "whisper-cpp",
      postProcessingMode: "lightweight",
    });

    expect(transcript).toMatchObject({
      id: "transcript_1",
      text: "Hello world",
      createdAt: "2026-05-07T00:00:00.000Z",
      durationMs: 1200,
      insertionStatus: "skipped",
    });
  });
});
```

- [ ] **Step 4: Run ASR tests**

Run: `pnpm --filter @molten-voice/asr run test`

Expected: ASR tests pass.

- [ ] **Step 5: Run check**

Run: `pnpm run check`

Expected: Typecheck, format, and lint pass.

- [ ] **Step 6: Commit dictation orchestrator**

Run:

```powershell
git add packages/asr packages/audio
git commit -m "feat: add dictation orchestrator"
```

Expected: Commit succeeds.

## Phase 6: Renderer MVP Flow

### Task 17: Add Setup Routes

**Files:**
- Modify: `apps/desktop/renderer/src/App.tsx`
- Create: `apps/desktop/renderer/src/routes.tsx`
- Create setup route components under `apps/desktop/renderer/src/features/setup/`

- [ ] **Step 1: Create setup route component directory**

Run: `New-Item -ItemType Directory -Force -Path apps\desktop\renderer\src\features\setup`

Expected: Directory is created.

- [ ] **Step 2: Create setup route data**

Create `apps/desktop/renderer/src/features/setup/setup-steps.ts`:

```ts
export const setupSteps = [
  { path: "/setup/welcome", title: "Private offline dictation" },
  { path: "/setup/hotkey", title: "Choose hold-to-talk hotkey" },
  { path: "/setup/models", title: "Choose local model" },
  { path: "/setup/download", title: "Download model" },
  { path: "/setup/permissions", title: "Enable permissions" },
  { path: "/setup/test", title: "Try dictation" },
  { path: "/setup/done", title: "Ready" },
] as const;
```

- [ ] **Step 3: Create setup flow component**

Create `apps/desktop/renderer/src/features/setup/SetupFlow.tsx`:

```tsx
import { setupSteps } from "./setup-steps";

export const SetupFlow = () => {
  return (
    <main className="app-shell">
      <section className="setup-panel">
        <p className="eyebrow">Setup</p>
        <h1>Molten Voice</h1>
        <ol className="step-list">
          {setupSteps.map((step, index) => (
            <li key={step.path}>
              <span>{index + 1}</span>
              {step.title}
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
};
```

- [ ] **Step 4: Render setup flow**

Modify `apps/desktop/renderer/src/App.tsx`:

```tsx
import { SetupFlow } from "./features/setup/SetupFlow";

export const App = () => {
  return <SetupFlow />;
};
```

- [ ] **Step 5: Add setup styles**

Append to `apps/desktop/renderer/src/styles.css`:

```css
.step-list {
  display: grid;
  gap: 10px;
  margin: 28px 0 0;
  padding: 0;
  list-style: none;
}

.step-list li {
  display: grid;
  grid-template-columns: 36px 1fr;
  align-items: center;
  gap: 14px;
  padding: 12px 0;
  border-bottom: 1px solid #ded8cf;
  font-size: 17px;
}

.step-list span {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: #243d35;
  color: #fff;
  font-size: 14px;
  font-weight: 700;
}
```

- [ ] **Step 6: Run desktop build**

Run: `pnpm --filter @molten-voice/desktop run build`

Expected: Build passes.

- [ ] **Step 7: Commit setup flow**

Run:

```powershell
git add apps/desktop/renderer/src
git commit -m "feat: add setup flow shell"
```

Expected: Commit succeeds.

### Task 18: Add Model Picker UI

**Files:**
- Modify: `apps/desktop/package.json`
- Create: `apps/desktop/renderer/src/features/setup/ModelPicker.tsx`
- Modify: `apps/desktop/renderer/src/features/setup/SetupFlow.tsx`
- Modify: `apps/desktop/renderer/src/styles.css`

- [ ] **Step 1: Add model catalog dependency to desktop package**

Modify `apps/desktop/package.json` dependencies:

```json
"@molten-voice/model-catalog": "workspace:*"
```

- [ ] **Step 2: Create model picker component**

Create `apps/desktop/renderer/src/features/setup/ModelPicker.tsx`:

```tsx
import { bundledModelCatalog } from "@molten-voice/model-catalog";

export const ModelPicker = () => {
  return (
    <div className="model-grid">
      {bundledModelCatalog.map((model) => (
        <article className="model-card" key={model.id}>
          <div>
            <h2>{model.displayName}</h2>
            <p>{model.runtime}</p>
          </div>
          <dl>
            <div>
              <dt>Languages</dt>
              <dd>{model.languages.join(", ")}</dd>
            </div>
            <div>
              <dt>Memory</dt>
              <dd>{Math.round(model.estimatedMemoryBytes / 1024 / 1024 / 1024)} GB</dd>
            </div>
          </dl>
        </article>
      ))}
    </div>
  );
};
```

- [ ] **Step 3: Render model picker below setup steps**

Modify `apps/desktop/renderer/src/features/setup/SetupFlow.tsx`:

```tsx
import { ModelPicker } from "./ModelPicker";
import { setupSteps } from "./setup-steps";

export const SetupFlow = () => {
  return (
    <main className="app-shell">
      <section className="setup-panel">
        <p className="eyebrow">Setup</p>
        <h1>Molten Voice</h1>
        <ol className="step-list">
          {setupSteps.map((step, index) => (
            <li key={step.path}>
              <span>{index + 1}</span>
              {step.title}
            </li>
          ))}
        </ol>
        <ModelPicker />
      </section>
    </main>
  );
};
```

- [ ] **Step 4: Add model picker styles**

Append to `apps/desktop/renderer/src/styles.css`:

```css
.model-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
  margin-top: 28px;
}

.model-card {
  border: 1px solid #d5cec2;
  border-radius: 8px;
  padding: 16px;
  background: #fffdf8;
}

.model-card h2 {
  margin: 0 0 6px;
  font-size: 18px;
}

.model-card dl {
  display: grid;
  gap: 8px;
  margin: 16px 0 0;
}

.model-card dt {
  color: #6f6a62;
  font-size: 12px;
  text-transform: uppercase;
}

.model-card dd {
  margin: 0;
}
```

- [ ] **Step 5: Run desktop typecheck**

Run: `pnpm --filter @molten-voice/desktop run typecheck`

Expected: Typecheck passes.

- [ ] **Step 6: Commit model picker**

Run:

```powershell
git add apps/desktop
git commit -m "feat: show bundled model picker"
```

Expected: Commit succeeds.

### Task 19: Add History UI Shell

**Files:**
- Create: `apps/desktop/renderer/src/features/history/HistoryView.tsx`
- Modify: `apps/desktop/renderer/src/App.tsx`
- Modify: `apps/desktop/renderer/src/styles.css`

- [ ] **Step 1: Create history directory**

Run: `New-Item -ItemType Directory -Force -Path apps\desktop\renderer\src\features\history`

Expected: Directory is created.

- [ ] **Step 2: Create history view component**

Create `apps/desktop/renderer/src/features/history/HistoryView.tsx`:

```tsx
const demoTranscripts = [
  { id: "1", text: "Hello world", createdAt: "2026-05-07 09:00" },
  { id: "2", text: "Privet mir", createdAt: "2026-05-07 09:05" },
];

export const HistoryView = () => {
  return (
    <section className="history-panel">
      <div className="section-heading">
        <p className="eyebrow">History</p>
        <h2>Recent transcripts</h2>
      </div>
      <input className="search-input" placeholder="Search transcripts" />
      <div className="history-list">
        {demoTranscripts.map((item) => (
          <article className="history-item" key={item.id}>
            <p>{item.text}</p>
            <time>{item.createdAt}</time>
          </article>
        ))}
      </div>
    </section>
  );
};
```

- [ ] **Step 3: Render history below setup**

Modify `apps/desktop/renderer/src/App.tsx`:

```tsx
import { HistoryView } from "./features/history/HistoryView";
import { SetupFlow } from "./features/setup/SetupFlow";

export const App = () => {
  return (
    <>
      <SetupFlow />
      <HistoryView />
    </>
  );
};
```

- [ ] **Step 4: Add history styles**

Append to `apps/desktop/renderer/src/styles.css`:

```css
.history-panel {
  width: min(920px, calc(100% - 64px));
  margin: 0 auto 48px;
}

.section-heading h2 {
  margin: 0;
  font-size: 28px;
}

.search-input {
  width: 100%;
  box-sizing: border-box;
  margin: 20px 0;
  padding: 12px 14px;
  border: 1px solid #c9c1b5;
  border-radius: 8px;
  font-size: 16px;
}

.history-list {
  display: grid;
  gap: 10px;
}

.history-item {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 0;
  border-bottom: 1px solid #ded8cf;
}

.history-item p {
  margin: 0;
  font-size: 16px;
}

.history-item time {
  color: #6f6a62;
  white-space: nowrap;
}
```

- [ ] **Step 5: Run desktop build**

Run: `pnpm --filter @molten-voice/desktop run build`

Expected: Build passes.

- [ ] **Step 6: Commit history shell**

Run:

```powershell
git add apps/desktop/renderer/src
git commit -m "feat: add history ui shell"
```

Expected: Commit succeeds.

### Task 20: Add Overlay UI Shell

**Files:**
- Create: `apps/desktop/renderer/src/features/overlay/OverlayView.tsx`
- Modify: `apps/desktop/renderer/src/App.tsx`
- Modify: `apps/desktop/renderer/src/styles.css`

- [ ] **Step 1: Create overlay directory**

Run: `New-Item -ItemType Directory -Force -Path apps\desktop\renderer\src\features\overlay`

Expected: Directory is created.

- [ ] **Step 2: Create overlay component**

Create `apps/desktop/renderer/src/features/overlay/OverlayView.tsx`:

```tsx
const bars = [18, 28, 42, 34, 50, 32, 24, 38, 20];

export const OverlayView = () => {
  return (
    <aside className="overlay-preview" aria-label="Recording overlay preview">
      <span className="recording-dot" />
      <div className="waveform" aria-hidden="true">
        {bars.map((height, index) => (
          <span key={`${height}-${index}`} style={{ height }} />
        ))}
      </div>
      <strong>Recording</strong>
    </aside>
  );
};
```

- [ ] **Step 3: Render overlay preview**

Modify `apps/desktop/renderer/src/App.tsx`:

```tsx
import { HistoryView } from "./features/history/HistoryView";
import { OverlayView } from "./features/overlay/OverlayView";
import { SetupFlow } from "./features/setup/SetupFlow";

export const App = () => {
  return (
    <>
      <SetupFlow />
      <HistoryView />
      <OverlayView />
    </>
  );
};
```

- [ ] **Step 4: Add overlay styles**

Append to `apps/desktop/renderer/src/styles.css`:

```css
.overlay-preview {
  position: fixed;
  left: 50%;
  bottom: 28px;
  transform: translateX(-50%);
  display: grid;
  grid-template-columns: 10px auto auto;
  align-items: center;
  gap: 14px;
  padding: 12px 18px;
  border: 1px solid rgb(255 255 255 / 18%);
  border-radius: 999px;
  background: rgb(20 20 20 / 88%);
  color: #fff;
  box-shadow: 0 18px 48px rgb(20 20 20 / 24%);
}

.recording-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: #ff5959;
}

.waveform {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 52px;
}

.waveform span {
  width: 4px;
  border-radius: 999px;
  background: #78dcca;
}
```

- [ ] **Step 5: Run desktop build**

Run: `pnpm --filter @molten-voice/desktop run build`

Expected: Build passes.

- [ ] **Step 6: Commit overlay shell**

Run:

```powershell
git add apps/desktop/renderer/src
git commit -m "feat: add overlay ui shell"
```

Expected: Commit succeeds.

## Phase 7: Main Process Boundaries

### Task 21: Add Window Manager Contract

**Files:**
- Create: `apps/desktop/electron/window-manager.ts`
- Modify: `apps/desktop/electron/main.ts`

- [ ] **Step 1: Create window manager**

Create `apps/desktop/electron/window-manager.ts`:

```ts
import { BrowserWindow } from "electron";
import { join } from "node:path";

export const createMainWindow = (): BrowserWindow => {
  const window = new BrowserWindow({
    width: 1120,
    height: 760,
    title: "Molten Voice",
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    void window.loadURL(process.env.VITE_DEV_SERVER_URL);
  }

  return window;
};

export const createOverlayWindow = (): BrowserWindow => {
  return new BrowserWindow({
    width: 520,
    height: 96,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    focusable: false,
    skipTaskbar: true,
    resizable: false,
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
};
```

- [ ] **Step 2: Use window manager in main**

Modify `apps/desktop/electron/main.ts`:

```ts
import { app } from "electron";
import { createMainWindow } from "./window-manager";

app.whenReady().then(() => {
  createMainWindow();
});
```

- [ ] **Step 3: Run desktop typecheck**

Run: `pnpm --filter @molten-voice/desktop run typecheck`

Expected: Typecheck passes.

- [ ] **Step 4: Commit window manager**

Run:

```powershell
git add apps/desktop/electron
git commit -m "feat: add electron window manager"
```

Expected: Commit succeeds.

### Task 22: Add IPC Handler Skeleton

**Files:**
- Create: `apps/desktop/electron/ipc-handlers.ts`
- Modify: `apps/desktop/electron/main.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Extend API type with app state**

Modify `packages/shared/src/index.ts`:

```ts
export * from "./dictation";
export * from "./errors";
export * from "./ipc";

export type Platform = "macos" | "windows";

export interface AppStateSnapshot {
  readonly setupComplete: boolean;
  readonly overlayState: import("./dictation").OverlayState;
}

export interface MoltenVoiceApi {
  readonly appName: string;
  readonly getAppState: () => Promise<AppStateSnapshot>;
}

export const APP_NAME = "Molten Voice";
```

- [ ] **Step 2: Create IPC handlers**

Create `apps/desktop/electron/ipc-handlers.ts`:

```ts
import { ipcMain } from "electron";
import type { AppStateSnapshot } from "@molten-voice/shared";
import { IpcChannels } from "@molten-voice/shared";

export const registerIpcHandlers = () => {
  ipcMain.handle(IpcChannels.getAppState, (): AppStateSnapshot => {
    return {
      setupComplete: false,
      overlayState: "hidden",
    };
  });
};
```

- [ ] **Step 3: Register IPC handlers in main**

Modify `apps/desktop/electron/main.ts`:

```ts
import { app } from "electron";
import { registerIpcHandlers } from "./ipc-handlers";
import { createMainWindow } from "./window-manager";

app.whenReady().then(() => {
  registerIpcHandlers();
  createMainWindow();
});
```

- [ ] **Step 4: Expose IPC through preload**

Modify `apps/desktop/electron/preload.ts`:

```ts
import { contextBridge, ipcRenderer } from "electron";
import { IpcChannels, type MoltenVoiceApi } from "@molten-voice/shared";

const api: MoltenVoiceApi = {
  appName: "Molten Voice",
  getAppState: () => ipcRenderer.invoke(IpcChannels.getAppState),
};

contextBridge.exposeInMainWorld("moltenVoice", api);
```

- [ ] **Step 5: Run typecheck**

Run: `pnpm run typecheck`

Expected: Typecheck passes.

- [ ] **Step 6: Commit IPC skeleton**

Run:

```powershell
git add apps/desktop/electron packages/shared
git commit -m "feat: add typed ipc handler skeleton"
```

Expected: Commit succeeds.

## Phase 8: Full Verification And Handoff

### Task 23: Run Full Check

**Files:**
- No code files expected.

- [ ] **Step 1: Run typecheck**

Run: `pnpm run typecheck`

Expected: Typecheck passes.

- [ ] **Step 2: Run format check**

Run: `pnpm run fmt`

Expected: Format check passes.

- [ ] **Step 3: Run lint**

Run: `pnpm run lint`

Expected: Lint passes.

- [ ] **Step 4: Run required combined check**

Run: `pnpm run check`

Expected: Typecheck, format, and lint pass.

- [ ] **Step 5: Run tests**

Run: `pnpm run test`

Expected: Unit tests pass.

### Task 24: Prepare Implementation Handoff

**Files:**
- Modify: `docs/superpowers/plans/2026-05-07-molten-voice-mvp-bootstrap.md`

- [ ] **Step 1: Mark completed checkboxes**

Mark only the steps that were completed during implementation.

- [ ] **Step 2: Record deferred items**

Add a short `Deferred Items` section if any task could not be completed because of network, OS permissions, package incompatibility, or missing design decisions.

- [ ] **Step 3: Final git status**

Run: `git status --short`

Expected: Clean working tree, or only intentionally unstaged local files called out in the handoff.

- [ ] **Step 4: Final commit**

Run:

```powershell
git add docs/superpowers/plans/2026-05-07-molten-voice-mvp-bootstrap.md
git commit -m "docs: add mvp bootstrap implementation plan"
```

Expected: Commit succeeds.

---

## Coverage Check

- Product setup flow is covered by Tasks 17 and 18.
- Monorepo architecture is covered by Tasks 2 through 5.
- Typed renderer-to-main boundary is covered by Tasks 6 and 22.
- Local-first model catalog is covered by Tasks 9 and 10.
- SQLite-backed history foundation is covered by Tasks 11 and 12.
- Audio and transcription service boundaries are covered by Tasks 13 through 16.
- Overlay UI foundation is covered by Task 20 and Electron overlay window preparation is covered by Task 21.
- Full completion requirement is covered by Task 23.

## Deferred Beyond This Plan

- Real Electron main build pipeline with bundled preload/main output.
- Real TanStack Router file-based route generation.
- Real shadcn/ui installation and component composition.
- Real microphone capture and MediaRecorder integration.
- Native/global hotkey key-up listener.
- Text insertion into active applications.
- Real model downloads, checksums, helper packs, and AI SDK v6 provider wiring.
- Real migrations and app data directory SQLite initialization.

## Implementation Status

Updated during implementation on 2026-05-08.

Completed:

- Repo/tooling baseline with pnpm workspaces, TypeScript, OxLint, OxFmt, Vitest.
- Electron + React renderer shell with Tailwind v4 and shadcn-compatible local UI primitives.
- Effect Schema contracts for dictation, settings, and IPC payloads.
- SQLite-backed transcript history and app settings repositories.
- Electron app database initialization in `app.getPath("userData")`.
- Mock audio capture, mock transcription provider, transcript post-processing, and ASR orchestrator.
- Typed preload API for app state, settings, history, and test dictation actions.
- Runtime IPC payload validation with Effect Schema in Electron handlers.
- Renderer workbench flow for model selection, dictation settings, test dictation, history search, delete, and clear.
- App state broadcasting from main to renderer windows.
- Separate overlay renderer app and overlay BrowserWindow visibility sync.
- Workflow error propagation to app snapshots and renderer alert UI.
- Electron main/preload Vite build pipeline, wired into `@molten-voice/desktop` build.
- Versioned SQLite migration runner with an applied migrations table and idempotent reopen coverage.
- TanStack Router code-based root route for the renderer workbench.
- Dedicated TanStack Router routes for setup, settings, and history screens.
- Captured audio cleanup boundary wired into the Effect-based dictation lifecycle.
- Native bridge Effect boundary for hold hotkeys, active application snapshots, and text insertion.
- Electron dictation flow now routes completed transcripts through the native insertion boundary.
- Model install planning and downloaded file size/checksum verification helpers.
- Mock model install progress in Electron app state with typed IPC and renderer progress UI.
- Bundled catalog download source metadata with GitHub Release URL resolution support.
- Mock Effect model installer service that verifies downloaded file metadata before marking it installed.
- Electron model install job extracted from IPC handlers for future real downloader replacement.

Verification completed:

- `pnpm --filter @molten-voice/desktop run build`
- `pnpm run check`
- `pnpm run test`

Still deferred:

- Real microphone capture.
- Real native/global hotkey key-down/key-up listener.
- Real text insertion into the active application.
- Real model download and helper pack management.
- AI SDK v6 local transcription provider wrapper.
- Real TanStack Router file-based route generation.

## Next Implementation Plan

Updated on 2026-05-09 after deciding to keep the catalog bundled and avoid tray/menu-bar download progress.

### Model Installation

- [ ] Add a Hugging Face source type next to the existing direct URL and GitHub Release source types.
- [ ] Store pinned upstream source metadata in the bundled catalog, not a remote catalog.
- [ ] Add installed model persistence in SQLite:
  - model id;
  - source type and pinned revision/tag;
  - installed path;
  - checksum;
  - installed-at timestamp;
  - verification status.
- [ ] Include installed model records in `AppStateSnapshot`.
- [ ] Update model cards to distinguish `Install`, `Installing`, `Installed`, `Repair`, and `Reinstall`.
- [ ] Replace the mock model install job with a real downloader that:
  - downloads to a temp directory;
  - streams progress into app state;
  - verifies size and sha256;
  - atomically moves verified files into the app model directory;
  - writes the installed model record only after verification succeeds.
- [ ] Add retry/cancel/repair commands after the real downloader exists.
- [ ] Add system notifications for install success/failure later. Notification copy and actions are intentionally deferred.

### Candidate Upstream Model Sources

These are candidate source links to prepare the bundled catalog. Checksums are not final until we download the exact files and compute sha256 locally.

#### WhisperKit Small, macOS Apple Silicon

- Upstream model repository: `argmaxinc/whisperkit-coreml`
- Source type to add: `huggingface-snapshot`
- Candidate pinned revision: `473f145758162af34aadf640d0e0970d89e8e453`
- Candidate subfolder: `openai_whisper-small`
- Browser link: `https://huggingface.co/argmaxinc/whisperkit-coreml/tree/473f145758162af34aadf640d0e0970d89e8e453/openai_whisper-small`
- Notes:
  - This is a directory of Core ML assets (`AudioEncoder.mlmodelc`, `MelSpectrogram.mlmodelc`, `TextDecoder.mlmodelc`, config files), not a single archive.
  - Installer should download a pinned snapshot/subfolder or a generated package created from that snapshot.
  - The search result reports this folder around 486 MB.

#### WhisperKit Small Compressed, macOS Apple Silicon

- Upstream model repository: `argmaxinc/whisperkit-coreml`
- Source type to add: `huggingface-snapshot`
- Candidate pinned revision: `4e186b908e840f4a90bce4fe58d86894cc97bef4`
- Candidate subfolder: `openai_whisper-small_216MB`
- Browser link: `https://huggingface.co/argmaxinc/whisperkit-coreml/tree/4e186b908e840f4a90bce4fe58d86894cc97bef4/openai_whisper-small_216MB`
- Notes:
  - Smaller candidate for faster first-run install.
  - The search result reports this folder around 217 MB.

#### Parakeet TDT 0.6B v3, Windows Experimental

- Upstream model repository: `nvidia/parakeet-tdt-0.6b-v3`
- Source type to add: `huggingface-file`
- Candidate pinned revision: `593ce355afbff63a6412af0a395e635065cc0fc0`
- Candidate file: `parakeet-tdt-0.6b-v3.nemo`
- Browser link: `https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3/tree/593ce355afbff63a6412af0a395e635065cc0fc0`
- Direct file candidate: `https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3/resolve/593ce355afbff63a6412af0a395e635065cc0fc0/parakeet-tdt-0.6b-v3.nemo`
- Notes:
  - Candidate file is about 2.51 GB in current search results.
  - License/source review is required before making this a default recommendation.
  - Runtime/helper support is still separate from downloading the model file.

### Recommended Next Order

1. Add Hugging Face source metadata types and URL/snapshot planning helpers.
2. Add installed model persistence in SQLite.
3. Wire installed model state into `AppStateSnapshot` and the renderer model cards.
4. Implement a real file downloader for single-file sources first, using Parakeet as the first integration target.
5. Implement snapshot/subfolder download support for WhisperKit Core ML directories.
6. Compute and pin real sha256 values for the exact selected artifacts.
7. Add notification boundary for install success/failure.
8. Continue with real transcription provider and helper/runtime integration.
