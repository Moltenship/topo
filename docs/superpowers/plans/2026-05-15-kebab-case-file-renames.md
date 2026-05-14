# Kebab Case File Renames Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename project-owned source files that are not in kebab-case to kebab-case and update all imports so file naming is consistent.

**Architecture:** Keep the migration mechanical: rename files with `git mv`, update import specifiers, then rely on typecheck, formatter, lint, and tests to catch stale paths. Treat ecosystem-mandated filenames as documented exceptions rather than forcing invalid kebab-case names.

**Tech Stack:** TypeScript, React, Electron Vite, Swift Package Manager, pnpm, tsgo, oxlint, oxfmt, Vitest.

---

## Scope And Exceptions

Rename these project-owned renderer files:

```text
apps/desktop/renderer/src/App.tsx -> apps/desktop/renderer/src/app.tsx
apps/desktop/renderer/src/OverlayApp.tsx -> apps/desktop/renderer/src/overlay-app.tsx
apps/desktop/renderer/src/components/AppShell.tsx -> apps/desktop/renderer/src/components/app-shell.tsx
apps/desktop/renderer/src/components/AppTitleBar.tsx -> apps/desktop/renderer/src/components/app-title-bar.tsx
apps/desktop/renderer/src/components/BrandMark.tsx -> apps/desktop/renderer/src/components/brand-mark.tsx
apps/desktop/renderer/src/features/dictation/DictationPage.tsx -> apps/desktop/renderer/src/features/dictation/dictation-page.tsx
apps/desktop/renderer/src/features/history/HistoryView.tsx -> apps/desktop/renderer/src/features/history/history-view.tsx
apps/desktop/renderer/src/features/models/ModelCard.tsx -> apps/desktop/renderer/src/features/models/model-card.tsx
apps/desktop/renderer/src/features/overlay/OverlayView.tsx -> apps/desktop/renderer/src/features/overlay/overlay-view.tsx
apps/desktop/renderer/src/features/settings/PostProcessingPage.tsx -> apps/desktop/renderer/src/features/settings/post-processing-page.tsx
apps/desktop/renderer/src/features/settings/SettingsPage.tsx -> apps/desktop/renderer/src/features/settings/settings-page.tsx
apps/desktop/renderer/src/features/setup/ModelPicker.tsx -> apps/desktop/renderer/src/features/setup/model-picker.tsx
apps/desktop/renderer/src/features/setup/SettingsStrip.tsx -> apps/desktop/renderer/src/features/setup/settings-strip.tsx
apps/desktop/renderer/src/features/setup/SetupFlow.tsx -> apps/desktop/renderer/src/features/setup/setup-flow.tsx
apps/desktop/renderer/src/features/setup/WorkbenchAlert.tsx -> apps/desktop/renderer/src/features/setup/workbench-alert.tsx
```

Do not rename these Swift Package Manager files:

```text
apps/desktop/electron/whisperkit-helper/Package.swift
apps/desktop/electron/whisperkit-helper/Package.resolved
```

Reason: SwiftPM discovers packages by the exact manifest filename `Package.swift`; `Package.resolved` is also a conventional SwiftPM lockfile name. Renaming them to `package.swift` / `package.resolved` would make the helper package harder or impossible to build with standard Swift tooling.

## Files And Responsibilities

- `apps/desktop/renderer/src/main.tsx`: update `OverlayApp` import to `./overlay-app`.
- `apps/desktop/renderer/src/routes.tsx`: update `App` import to `./app`.
- `apps/desktop/renderer/src/app.tsx`: renamed from `App.tsx`; update imports for app shell, title bar, history, settings, and post-processing pages.
- `apps/desktop/renderer/src/overlay-app.tsx`: renamed from `OverlayApp.tsx`; update overlay view import.
- `apps/desktop/renderer/src/components/app-title-bar.tsx`: renamed from `AppTitleBar.tsx`; update brand mark import.
- `apps/desktop/renderer/src/components/app-shell.tsx`: renamed from `AppShell.tsx`; no import path changes inside expected.
- `apps/desktop/renderer/src/components/brand-mark.tsx`: renamed from `BrandMark.tsx`; no import path changes inside expected.
- `apps/desktop/renderer/src/features/settings/settings-page.tsx`: renamed from `SettingsPage.tsx`; update `ModelCard` alias import.
- `apps/desktop/renderer/src/features/setup/setup-flow.tsx`: renamed from `SetupFlow.tsx`; update model picker, settings strip, and workbench alert imports.
- `apps/desktop/renderer/src/features/setup/model-picker.tsx`: renamed from `ModelPicker.tsx`; update `ModelCard` alias import.
- Other renamed renderer feature files only need filesystem renames unless typecheck reveals missed imports.

## Task 1: Add Filename Policy Guard

**Files:**
- Create: `scripts/check-kebab-case-files.mjs`
- Modify: `package.json`

- [ ] **Step 1: Add the guard script**

Create `scripts/check-kebab-case-files.mjs`:

```js
import { execFileSync } from "node:child_process";
import path from "node:path";

const allowedBasenames = new Set([
  "AGENTS.md",
  "Package.swift",
  "Package.resolved",
]);

const ignoredPathParts = new Set([
  ".git",
  ".local",
  "node_modules",
  "dist",
  "out",
  "coverage",
]);

const kebabCaseFile = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+)*$/;

const files = execFileSync("rg", ["--files"], { encoding: "utf8" })
  .trim()
  .split("\n")
  .filter(Boolean);

const violations = files.filter((file) => {
  const parts = file.split(path.sep);
  if (parts.some((part) => ignoredPathParts.has(part))) {
    return false;
  }

  const basename = path.basename(file);
  return !allowedBasenames.has(basename) && !kebabCaseFile.test(basename);
});

if (violations.length > 0) {
  console.error("Non kebab-case file names found:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}
```

- [ ] **Step 2: Wire the guard into lint**

Modify root `package.json` scripts from:

```json
"lint": "pnpm -r run lint"
```

to:

```json
"lint": "pnpm -r run lint && node scripts/check-kebab-case-files.mjs"
```

- [ ] **Step 3: Run the guard and verify it fails before renames**

Run:

```bash
node scripts/check-kebab-case-files.mjs
```

Expected: FAIL and list the 15 renderer files from the scope section. It must not list `Package.swift` or `Package.resolved`.

- [ ] **Step 4: Commit the failing guard**

Run:

```bash
git add package.json scripts/check-kebab-case-files.mjs
git commit -m "chore: enforce kebab-case file names" -m "Add a repository guard for kebab-case filenames with explicit exceptions for tool-mandated names." -m "Co-authored-by: Codex <noreply@openai.com>"
```

## Task 2: Rename Top-Level Renderer Entrypoints And Components

**Files:**
- Rename: `apps/desktop/renderer/src/App.tsx` -> `apps/desktop/renderer/src/app.tsx`
- Rename: `apps/desktop/renderer/src/OverlayApp.tsx` -> `apps/desktop/renderer/src/overlay-app.tsx`
- Rename: `apps/desktop/renderer/src/components/AppShell.tsx` -> `apps/desktop/renderer/src/components/app-shell.tsx`
- Rename: `apps/desktop/renderer/src/components/AppTitleBar.tsx` -> `apps/desktop/renderer/src/components/app-title-bar.tsx`
- Rename: `apps/desktop/renderer/src/components/BrandMark.tsx` -> `apps/desktop/renderer/src/components/brand-mark.tsx`
- Modify: `apps/desktop/renderer/src/main.tsx`
- Modify: `apps/desktop/renderer/src/routes.tsx`
- Modify: `apps/desktop/renderer/src/app.tsx`
- Modify: `apps/desktop/renderer/src/overlay-app.tsx`
- Modify: `apps/desktop/renderer/src/components/app-title-bar.tsx`

- [ ] **Step 1: Rename files with git mv**

Run:

```bash
git mv apps/desktop/renderer/src/App.tsx apps/desktop/renderer/src/app.tsx
git mv apps/desktop/renderer/src/OverlayApp.tsx apps/desktop/renderer/src/overlay-app.tsx
git mv apps/desktop/renderer/src/components/AppShell.tsx apps/desktop/renderer/src/components/app-shell.tsx
git mv apps/desktop/renderer/src/components/AppTitleBar.tsx apps/desktop/renderer/src/components/app-title-bar.tsx
git mv apps/desktop/renderer/src/components/BrandMark.tsx apps/desktop/renderer/src/components/brand-mark.tsx
```

- [ ] **Step 2: Update imports**

Apply these import path changes:

```ts
// apps/desktop/renderer/src/main.tsx
import { OverlayApp } from "./overlay-app";

// apps/desktop/renderer/src/routes.tsx
import { App } from "./app";

// apps/desktop/renderer/src/app.tsx
import { AppShell } from "./components/app-shell";
import { AppTitleBar } from "./components/app-title-bar";

// apps/desktop/renderer/src/overlay-app.tsx
import { OverlayView } from "./features/overlay/overlay-view";

// apps/desktop/renderer/src/components/app-title-bar.tsx
import { BrandMark } from "./brand-mark";
```

- [ ] **Step 3: Run focused typecheck**

Run:

```bash
pnpm --filter @topo/desktop typecheck
```

Expected: FAIL only for imports to feature files not renamed yet, or PASS if all top-level imports are covered. If it fails for any path from Task 2, fix that exact import before continuing.

- [ ] **Step 4: Run the filename guard**

Run:

```bash
node scripts/check-kebab-case-files.mjs
```

Expected: FAIL and list only the remaining feature files from Tasks 3 and 4.

- [ ] **Step 5: Commit**

Run:

```bash
git add apps/desktop/renderer/src package.json scripts/check-kebab-case-files.mjs
git commit -m "chore: rename renderer entry files to kebab-case" -m "Rename top-level renderer and component files and update their imports." -m "Co-authored-by: Codex <noreply@openai.com>"
```

## Task 3: Rename Renderer Feature Pages

**Files:**
- Rename: `apps/desktop/renderer/src/features/dictation/DictationPage.tsx` -> `apps/desktop/renderer/src/features/dictation/dictation-page.tsx`
- Rename: `apps/desktop/renderer/src/features/history/HistoryView.tsx` -> `apps/desktop/renderer/src/features/history/history-view.tsx`
- Rename: `apps/desktop/renderer/src/features/models/ModelCard.tsx` -> `apps/desktop/renderer/src/features/models/model-card.tsx`
- Rename: `apps/desktop/renderer/src/features/overlay/OverlayView.tsx` -> `apps/desktop/renderer/src/features/overlay/overlay-view.tsx`
- Rename: `apps/desktop/renderer/src/features/settings/PostProcessingPage.tsx` -> `apps/desktop/renderer/src/features/settings/post-processing-page.tsx`
- Rename: `apps/desktop/renderer/src/features/settings/SettingsPage.tsx` -> `apps/desktop/renderer/src/features/settings/settings-page.tsx`
- Modify: `apps/desktop/renderer/src/app.tsx`
- Modify: `apps/desktop/renderer/src/features/settings/settings-page.tsx`

- [ ] **Step 1: Rename files with git mv**

Run:

```bash
git mv apps/desktop/renderer/src/features/dictation/DictationPage.tsx apps/desktop/renderer/src/features/dictation/dictation-page.tsx
git mv apps/desktop/renderer/src/features/history/HistoryView.tsx apps/desktop/renderer/src/features/history/history-view.tsx
git mv apps/desktop/renderer/src/features/models/ModelCard.tsx apps/desktop/renderer/src/features/models/model-card.tsx
git mv apps/desktop/renderer/src/features/overlay/OverlayView.tsx apps/desktop/renderer/src/features/overlay/overlay-view.tsx
git mv apps/desktop/renderer/src/features/settings/PostProcessingPage.tsx apps/desktop/renderer/src/features/settings/post-processing-page.tsx
git mv apps/desktop/renderer/src/features/settings/SettingsPage.tsx apps/desktop/renderer/src/features/settings/settings-page.tsx
```

- [ ] **Step 2: Update imports**

Apply these import path changes:

```ts
// apps/desktop/renderer/src/app.tsx
import { HistoryView } from "./features/history/history-view";
import { PostProcessingPage } from "./features/settings/post-processing-page";
import { SettingsPage } from "./features/settings/settings-page";

// apps/desktop/renderer/src/features/settings/settings-page.tsx
import { ModelCard } from "@/features/models/model-card";
```

- [ ] **Step 3: Search for stale PascalCase imports**

Run:

```bash
rg -n "DictationPage|HistoryView|ModelCard|OverlayView|PostProcessingPage|SettingsPage|features/.*/[A-Z]|components/[A-Z]" apps/desktop/renderer/src
```

Expected: remaining matches are type/component names only, not import specifier paths. Any import path containing a PascalCase filename must be changed to kebab-case.

- [ ] **Step 4: Run focused typecheck**

Run:

```bash
pnpm --filter @topo/desktop typecheck
```

Expected: PASS.

- [ ] **Step 5: Run the filename guard**

Run:

```bash
node scripts/check-kebab-case-files.mjs
```

Expected: FAIL and list only the setup feature files from Task 4.

- [ ] **Step 6: Commit**

Run:

```bash
git add apps/desktop/renderer/src
git commit -m "chore: rename renderer feature pages to kebab-case" -m "Rename feature page files and update imports to match kebab-case filenames." -m "Co-authored-by: Codex <noreply@openai.com>"
```

## Task 4: Rename Setup Feature Files

**Files:**
- Rename: `apps/desktop/renderer/src/features/setup/ModelPicker.tsx` -> `apps/desktop/renderer/src/features/setup/model-picker.tsx`
- Rename: `apps/desktop/renderer/src/features/setup/SettingsStrip.tsx` -> `apps/desktop/renderer/src/features/setup/settings-strip.tsx`
- Rename: `apps/desktop/renderer/src/features/setup/SetupFlow.tsx` -> `apps/desktop/renderer/src/features/setup/setup-flow.tsx`
- Rename: `apps/desktop/renderer/src/features/setup/WorkbenchAlert.tsx` -> `apps/desktop/renderer/src/features/setup/workbench-alert.tsx`
- Modify: `apps/desktop/renderer/src/app.tsx`
- Modify: `apps/desktop/renderer/src/features/setup/setup-flow.tsx`
- Modify: `apps/desktop/renderer/src/features/setup/model-picker.tsx`

- [ ] **Step 1: Rename files with git mv**

Run:

```bash
git mv apps/desktop/renderer/src/features/setup/ModelPicker.tsx apps/desktop/renderer/src/features/setup/model-picker.tsx
git mv apps/desktop/renderer/src/features/setup/SettingsStrip.tsx apps/desktop/renderer/src/features/setup/settings-strip.tsx
git mv apps/desktop/renderer/src/features/setup/SetupFlow.tsx apps/desktop/renderer/src/features/setup/setup-flow.tsx
git mv apps/desktop/renderer/src/features/setup/WorkbenchAlert.tsx apps/desktop/renderer/src/features/setup/workbench-alert.tsx
```

- [ ] **Step 2: Update imports**

Apply these import path changes:

```ts
// apps/desktop/renderer/src/app.tsx
import { SetupFlow } from "./features/setup/setup-flow";

// apps/desktop/renderer/src/features/setup/setup-flow.tsx
import { ModelPicker } from "./model-picker";
import { SettingsStrip } from "./settings-strip";
import { WorkbenchAlert } from "./workbench-alert";

// apps/desktop/renderer/src/features/setup/model-picker.tsx
import { ModelCard } from "@/features/models/model-card";
```

- [ ] **Step 3: Run stale import search**

Run:

```bash
rg -n "from .*([A-Z][A-Za-z]+\\.tsx?|/[A-Z][A-Za-z]+)|features/models/ModelCard|features/setup/(ModelPicker|SettingsStrip|SetupFlow|WorkbenchAlert)" apps/desktop/renderer/src
```

Expected: no matches.

- [ ] **Step 4: Run the filename guard**

Run:

```bash
node scripts/check-kebab-case-files.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add apps/desktop/renderer/src
git commit -m "chore: rename setup files to kebab-case" -m "Rename setup feature files and update imports to complete renderer filename consistency." -m "Co-authored-by: Codex <noreply@openai.com>"
```

## Task 5: Full Verification

**Files:**
- No source edits expected unless verification reveals missed imports.

- [ ] **Step 1: Run focused desktop tests**

Run:

```bash
pnpm --filter @topo/desktop test
```

Expected: PASS.

- [ ] **Step 2: Run repository check**

Run:

```bash
pnpm run check
```

Expected: PASS, including `node scripts/check-kebab-case-files.mjs` through the root lint script.

- [ ] **Step 3: Confirm no unintended filenames remain**

Run:

```bash
node scripts/check-kebab-case-files.mjs
```

Expected: PASS.

- [ ] **Step 4: Inspect git diff for pure rename intent**

Run:

```bash
git status --short
git diff --stat HEAD
git diff --name-status HEAD
```

Expected: file renames plus import changes and guard script only. No generated artifacts, lockfile churn, or unrelated edits.

- [ ] **Step 5: Final commit if fixes were needed during verification**

If any missed import fixes were made after Task 4, run:

```bash
git add apps/desktop/renderer/src scripts/check-kebab-case-files.mjs package.json
git commit -m "chore: finish kebab-case filename migration" -m "Fix remaining import paths and verify the filename guard passes." -m "Co-authored-by: Codex <noreply@openai.com>"
```

If no fixes were needed, do not create an empty commit.

## Self-Review

- Spec coverage: the plan covers every non-kebab project-owned source filename found by `rg --files`, and documents why SwiftPM files are exceptions.
- Placeholder scan: no `TBD`, `TODO`, or unspecified implementation steps remain.
- Type consistency: import paths use the exact target filenames listed in the scope section.
- Verification coverage: focused desktop typecheck/test plus required `pnpm run check` are included, and the new guard prevents regressions.
