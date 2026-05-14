# Install Flow Improvement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve first-run and settings install flow so macOS and Windows users can install the correct local runtime plus model, understand model speed/accuracy tradeoffs, use true push-to-talk, and configure post-processing in a separate tab.

**Architecture:** Treat runtime packs and model artifacts as separate installable requirements for the same catalog entry. Electron main remains the owner of filesystem, download, native hotkey, runtime probing, and secret handling; renderer receives typed snapshots and events through shared contracts. Keep model metadata, runtime metadata, install state, readiness state, and post-processing provider settings as explicit domain concepts instead of UI-only flags.

**Tech Stack:** Electron, React, Effect TS, Schema contracts, SQLite repositories, streamed downloads, checksum verification, native helper bridges for macOS/Windows, AI SDK for OpenAI/OpenRouter-compatible post-processing, and an AI SDK-compatible Apple Intelligence wrapper over a macOS native bridge.

---

## Review Summary

Current Topo already has a good foundation:

- `packages/model-catalog/src/model-catalog.ts` defines model metadata, including runtime, platform, memory estimate, speed label, quality label, badges, and checksums.
- `apps/desktop/electron/model-install-job.ts` streams model downloads, supports cancellation, verifies size and SHA-256, installs atomically through a temporary `.download` file, and handles local dev model resources.
- `apps/desktop/electron/whisper-cpp-runtime.ts` resolves an existing `whisper.cpp` binary from env, bundled resources, or PATH, then probes it.
- `apps/desktop/electron/model-readiness.ts` and `apps/desktop/renderer/src/features/settings/SettingsPage.tsx` already distinguish installed model state from runtime readiness.
- `packages/asr/src/post-processing.ts` currently only does lightweight local normalization; the requested AI-backed post-processing is not yet modeled as a provider surface.
- `apps/desktop/electron/electron-hotkey-bridge.ts` fakes down/up by toggling an Electron global shortcut callback. That is enough for toggle-to-talk, but not true push-to-talk.

Reference findings from Handy:

- Handy keeps model metadata rich: `accuracy_score`, `speed_score`, model size, supported languages, translation support, recommended flag, custom model flag, and directory-vs-file artifact shape in `.local/handy/src-tauri/src/managers/model.rs`.
- Handy tracks transient states separately in UI: downloading, verifying, extracting, switching, active, available, downloadable. The frontend model store also computes smoothed download speed from progress events in `.local/handy/src/stores/modelStore.ts`.
- Handy implements true push-to-talk by feeding real press/release events into a serialized coordinator in `.local/handy/src-tauri/src/transcription_coordinator.rs`.
- Handy's post-processing is a separate settings area with provider selection, model selection, API key storage, prompt management, and Apple Intelligence availability handling.
- Apple Intelligence should be exposed to app code as a local AI SDK-compatible language model wrapper, not as an HTTP provider. The wrapper can keep post-processing orchestration uniform while Electron main and a Swift helper own the actual `FoundationModels.SystemLanguageModel` call.

Reference findings from t3code:

- Keep `packages/contracts` schema-only and push runtime behavior into app/package services.
- Prefer explicit Effect service boundaries and typed IPC contracts over ad-hoc renderer/main coupling.
- Use durable state transitions and event projection patterns for long-running operations, especially downloads, runtime startup, and failure recovery.

## Target User Flow

First run:

1. User lands on setup.
2. App detects platform and CPU architecture.
3. App recommends a model/runtime pair.
4. User sees model cards with speed, accuracy, language coverage, disk size, memory estimate, and runtime requirement.
5. User clicks install once.
6. App downloads runtime pack if missing, downloads model artifact if missing, verifies both, records installed artifact rows, and marks the pair ready.
7. User configures hotkey mode and microphone.
8. User tests dictation.
9. Setup is complete only when the selected model is ready and the hotkey path is usable.

Settings:

1. `Models` tab manages local ASR models and runtime packs.
2. `Dictation` tab manages hotkey, push-to-talk, microphone, overlay, insertion, and history behavior.
3. `Post-processing` tab manages raw/lightweight/API provider processing, including local Apple Intelligence through the same AI SDK-facing wrapper shape used by remote providers.

## Data Model Changes

Add runtime pack metadata alongside model metadata instead of hiding runtime inside model rows.

### Files

- Modify `packages/model-catalog/src/model-catalog.ts`
- Create `packages/model-catalog/src/runtime-catalog.ts`
- Modify `packages/model-catalog/src/index.ts`
- Modify `packages/contracts/src/installed-model.ts`
- Create `packages/contracts/src/installed-runtime.ts`
- Modify `packages/contracts/src/ipc.ts`
- Modify `packages/db/src/schema.ts`
- Create `packages/db/src/installed-runtime-repository.ts`
- Create `packages/db/src/installed-runtime-repository.test.ts`
- Modify `packages/db/src/app-database.ts`

### Contract Shape

Use this shape as the implementation target:

```ts
export type RuntimeId = "whisperkit" | "whisper-cpp-windows-x64" | "whisper-cpp-macos-arm64";

export interface RuntimeCatalogEntry {
  readonly id: RuntimeId;
  readonly displayName: string;
  readonly engine: "whisperkit" | "whisper-cpp";
  readonly platform: "macos" | "windows";
  readonly architecture: "x64" | "arm64";
  readonly version: string;
  readonly source: DownloadSource | { readonly type: "system"; readonly description: string };
  readonly checksumSha256: string | null;
  readonly downloadSizeBytes: number;
  readonly diskSizeBytes: number;
  readonly binaryRelativePath: string | null;
  readonly probeArgs: readonly string[];
}

export interface InstalledRuntimeRecord {
  readonly id: string;
  readonly runtimeId: RuntimeId;
  readonly engine: "whisperkit" | "whisper-cpp";
  readonly installedPath: string;
  readonly binaryPath: string | null;
  readonly checksumSha256: string | null;
  readonly verificationStatus: "verified" | "corrupt" | "missing";
  readonly installedAt: string;
  readonly lastProbedAt: string | null;
  readonly lastProbeMessage: string | null;
}
```

Model catalog entries should point at a runtime requirement:

```ts
readonly runtimeRequirement: {
  readonly engine: "whisperkit" | "whisper-cpp";
  readonly supportedRuntimeIds: readonly RuntimeId[];
};
readonly accuracyScore: number;
readonly speedScore: number;
readonly recommendedReason: string;
```

Keep the existing `qualityLabel` and `speedLabel` for UI readability, but add numeric scores so the renderer can show comparisons without hardcoding Handy-style assumptions.

## Implementation Slices

### Task 1: Runtime Catalog and Installed Runtime Records

**Files:**

- Create `packages/model-catalog/src/runtime-catalog.ts`
- Modify `packages/model-catalog/src/model-catalog.ts`
- Modify `packages/model-catalog/src/index.ts`
- Create `packages/contracts/src/installed-runtime.ts`
- Modify `packages/contracts/src/index.ts`
- Modify `packages/contracts/src/ipc.ts`
- Modify `packages/shared/src/index.ts`

- [x] Add `RuntimeCatalogEntry`, `RuntimeId`, and `bundledRuntimeCatalog`.
- [x] Add `runtimeRequirement`, `accuracyScore`, `speedScore`, and `recommendedReason` to `ModelCatalogEntry`.
- [x] Represent macOS WhisperKit as a system runtime initially, because on-device Apple Silicon support should not require downloading a CLI.
- [x] Represent Windows `whisper.cpp` as a downloadable runtime pack, with `binaryRelativePath` pointing to `whisper-cli.exe`.
- [x] Add `InstalledRuntimeRecord` Schema contract.
- [x] Add `installedRuntimes` and `runtimeInstallProgress` to `AppStateSnapshot`.
- [x] Update existing tests in `packages/model-catalog` and `packages/contracts`.

Run:

```bash
pnpm --filter @topo/model-catalog run test
pnpm --filter @topo/contracts run test
```

Expected: all package tests pass.

Commit:

```bash
git add packages/model-catalog packages/contracts packages/shared
git commit -m "feat(model-catalog): add runtime catalog metadata"
```

### Task 2: Runtime Install Job

**Files:**

- Create `apps/desktop/electron/runtime-install-job.ts`
- Create `apps/desktop/electron/runtime-install-job.test.ts`
- Modify `apps/desktop/electron/model-install-job.ts`
- Modify `apps/desktop/electron/ipc-handlers.ts`

- [x] Extract common streamed artifact download helpers from `model-install-job.ts` into a private helper module or shared functions in the same Electron folder.
- [x] Implement `RuntimeInstallJob` with the same lifecycle as model install: `queued`, `resolving`, `downloading`, `verifying`, `installing`, `installed`, `failed`, `canceled`.
- [x] Support archive extraction for runtime packs, because Windows and macOS runtime releases are likely zipped.
- [x] Verify extracted binary existence after extraction.
- [x] Record installed runtime rows in SQLite only after checksum and binary probe pass.
- [x] Keep runtime installation separate from model installation so a single runtime can serve multiple model artifacts.

Test cases:

- Cancels an active runtime download and deletes the temporary file.
- Fails if checksum mismatches and removes the temp artifact.
- Extracts archive into a `.extracting` directory before renaming to final location.
- Records `binaryPath` from `binaryRelativePath`.

Run:

```bash
pnpm --filter @topo/desktop run test -- runtime-install-job.test.ts
pnpm run check
```

Expected: runtime install tests and full check pass.

Commit:

```bash
git add apps/desktop/electron packages/db packages/contracts
git commit -m "feat(desktop): install runtime packs"
```

### Task 3: Combined Install Orchestration

**Files:**

- Create `apps/desktop/electron/install-plan.ts`
- Create `apps/desktop/electron/install-plan.test.ts`
- Modify `apps/desktop/electron/ipc-handlers.ts`
- Modify `apps/desktop/renderer/src/api/renderer-api.ts`
- Modify `packages/contracts/src/ipc.ts`

- [x] Add a typed `InstallModelBundleRequest` IPC request with `modelId`.
- [x] Build an install plan that resolves selected model, matching runtime for current platform/arch, installed runtime state, and installed model state.
- [x] If runtime is already verified, skip runtime download.
- [x] If model is already verified, skip model download.
- [x] If either artifact is corrupt or missing, repair only that artifact.
- [x] Publish progress as a single bundle operation with child progress for runtime and model.
- [x] Keep existing `installModel` IPC as a low-level operation for tests or future advanced UI, but make setup use the bundle install.

Bundle progress shape:

```ts
export interface InstallBundleProgress {
  readonly modelId: string;
  readonly runtimeId: string | null;
  readonly stage:
    | "runtime"
    | "model"
    | "readiness"
    | "installed"
    | "failed"
    | "canceled";
  readonly runtimeProgress: ModelInstallProgress | null;
  readonly modelProgress: ModelInstallProgress | null;
  readonly errorMessage: string | null;
}
```

Run:

```bash
pnpm --filter @topo/desktop run test -- install-plan.test.ts
pnpm run check
```

Expected: install plan tests and full check pass.

Commit:

```bash
git add apps/desktop/electron apps/desktop/renderer/src/api packages/contracts
git commit -m "feat(desktop): orchestrate model and runtime install"
```

### Task 4: Readiness Uses Installed Runtime Records

**Files:**

- Modify `apps/desktop/electron/model-readiness.ts`
- Modify `apps/desktop/electron/model-readiness.test.ts`
- Modify `apps/desktop/electron/whisper-cpp-runtime.ts`
- Modify `apps/desktop/electron/ipc-handlers.ts`

- [x] Change readiness computation to consume `installedModels`, `installedRuntimes`, runtime catalog, model catalog, and probe results.
- [x] Runtime resolution order should be: installed runtime record, env override, bundled resource, PATH.
- [x] Green readiness means verified model plus verified/probed runtime.
- [x] Yellow readiness means model installed but runtime absent or unprobed.
- [x] Red readiness means runtime probe failed or artifact verification failed.
- [x] Add a Settings refresh action that clears cached runtime probe results and republishes app state.

Run:

```bash
pnpm --filter @topo/desktop run test -- model-readiness.test.ts whisper-cpp-runtime.test.ts
pnpm run check
```

Expected: readiness tests and full check pass.

Commit:

```bash
git add apps/desktop/electron packages/contracts
git commit -m "feat(desktop): compute readiness from installed runtimes"
```

### Task 5: Model Info and Install UI

**Files:**

- Modify `apps/desktop/renderer/src/features/setup/ModelPicker.tsx`
- Modify `apps/desktop/renderer/src/features/setup/SetupFlow.tsx`
- Modify `apps/desktop/renderer/src/features/settings/SettingsPage.tsx`
- Optionally create `apps/desktop/renderer/src/features/models/ModelCard.tsx`

- [x] Extract a reusable `ModelCard` for setup and settings.
- [x] Show speed and accuracy as direct comparison values: labels plus numeric score bars.
- [x] Show supported languages, runtime requirement, download size, disk size, and memory estimate.
- [x] Show runtime install progress separately from model install progress when bundle install is running.
- [x] Sort recommended model first, installed/active models next, then compatible models by download size.
- [x] Keep incompatible platform models visible only in an advanced/diagnostic section or hide them from first-run setup.

Run:

```bash
pnpm --filter @topo/desktop run test
pnpm run check
```

Expected: desktop tests and full check pass.

Commit:

```bash
git add apps/desktop/renderer
git commit -m "feat(renderer): show model speed accuracy and runtime install state"
```

### Task 6: True Push-to-Talk Coordinator

**Files:**

- Modify `packages/contracts/src/dictation.ts`
- Modify `packages/contracts/src/settings.ts`
- Modify `packages/native-bridge/src/native-bridge-service.ts`
- Create `apps/desktop/electron/hotkey-coordinator.ts`
- Create `apps/desktop/electron/hotkey-coordinator.test.ts`
- Modify `apps/desktop/electron/electron-hotkey-bridge.ts`
- Modify `apps/desktop/electron/ipc-handlers.ts`
- Modify `apps/desktop/renderer/src/features/settings/SettingsPage.tsx`

- [ ] Stop coercing persisted `push-to-talk` back to `toggle-to-talk` in `getSettings`.
- [ ] Keep `RecordingMode` values: `toggle-to-talk`, `push-to-talk`, `push-to-talk-with-silence-timeout`.
- [ ] Add a coordinator modeled after Handy: `Idle`, `Recording`, `Processing`.
- [ ] Debounce press events and always allow release events through for push-to-talk.
- [ ] On Windows, evaluate a low-level keyboard hook helper for real down/up. Electron `globalShortcut` is not enough because it does not reliably provide release.
- [ ] On macOS, use a native helper or Electron input-monitoring path that can emit press/release after accessibility/input monitoring permission is granted.
- [ ] Keep toggle mode as the fallback if native down/up is unavailable.
- [ ] Add UI copy that clearly distinguishes "Press once" from "Hold while speaking".

Coordinator rules:

```ts
Idle + down + toggle => start recording
Recording + down + toggle => stop and process
Idle + down + push-to-talk => start recording
Recording + up + push-to-talk => stop and process
Processing + any hotkey event => ignore
Recording + cancel => cancel recording and return Idle
```

Run:

```bash
pnpm --filter @topo/desktop run test -- hotkey-coordinator.test.ts electron-hotkey-bridge.test.ts
pnpm run check
```

Expected: hotkey coordinator tests and full check pass.

Commit:

```bash
git add packages/contracts packages/native-bridge apps/desktop/electron apps/desktop/renderer
git commit -m "feat(dictation): add true push to talk coordination"
```

### Task 7: Post-Processing Contracts and Providers

**Files:**

- Modify `packages/contracts/src/settings.ts`
- Create `packages/contracts/src/post-processing.ts`
- Modify `packages/asr/src/post-processing.ts`
- Create `packages/asr/src/post-processing-provider.ts`
- Create `packages/asr/src/post-processing-provider.test.ts`
- Create `packages/asr/src/apple-intelligence-ai-sdk-provider.ts`
- Create `packages/asr/src/apple-intelligence-ai-sdk-provider.test.ts`
- Modify `packages/asr/src/dictation-orchestrator.ts`
- Modify `apps/desktop/electron/ipc-handlers.ts`

- [ ] Split post-processing into modes: `raw`, `lightweight`, `apple-intelligence`, `api`.
- [ ] Add provider settings for `openai`, `openrouter`, and `custom-openai-compatible`.
- [ ] Store API keys through Electron main using safe storage, not renderer state or plain SQLite.
- [ ] Use AI SDK for API providers so OpenAI and OpenRouter share one abstraction.
- [ ] Add an AI SDK-compatible `appleIntelligence("default")` language model wrapper that calls a local bridge instead of HTTP.
- [ ] Keep the wrapper boundary in TypeScript and the Foundation Models access in Electron main/native bridge so renderer code never calls Apple APIs directly.
- [ ] Add a post-processing request object containing raw transcript, language, prompt id, provider id, model id, and target schema.
- [ ] Keep lightweight normalization as the offline default.
- [ ] Make post-processing failure non-destructive: preserve raw transcript and show a recoverable warning unless the user explicitly requires post-processing.

Provider interface:

```ts
export interface PostProcessingProvider {
  readonly process: (
    input: PostProcessingInput,
  ) => Effect.Effect<PostProcessingResult, PostProcessingError>;
}
```

Apple Intelligence wrapper target:

```ts
import { generateText } from "ai";
import { appleIntelligence } from "./apple-intelligence-ai-sdk-provider";

const result = await generateText({
  model: appleIntelligence("default"),
  prompt: "Clean this transcript: ...",
});
```

The wrapper should adapt AI SDK model calls to:

```txt
AI SDK language model wrapper
  -> Electron main post-processing service
  -> macOS Swift helper
  -> FoundationModels.SystemLanguageModel
```

Run:

```bash
pnpm --filter @topo/asr run test -- post-processing-provider.test.ts post-processing.test.ts
pnpm run check
```

Expected: ASR tests and full check pass.

Commit:

```bash
git add packages/contracts packages/asr apps/desktop/electron
git commit -m "feat(asr): add post processing providers"
```

### Task 8: Post-Processing Tab

**Files:**

- Create `apps/desktop/renderer/src/features/settings/PostProcessingPage.tsx`
- Modify `apps/desktop/renderer/src/features/settings/SettingsPage.tsx`
- Modify `apps/desktop/renderer/src/components/AppShell.tsx`
- Modify `apps/desktop/renderer/src/routes.tsx`
- Modify `apps/desktop/renderer/src/api/renderer-api.ts`

- [ ] Move post-processing controls out of General settings.
- [ ] Add provider selection: Lightweight, Apple Intelligence wrapper on supported macOS, OpenAI, OpenRouter, Custom.
- [ ] Add API key field with redacted display and "test connection".
- [ ] Add model field and optional fetch models action for OpenAI-compatible providers.
- [ ] Add prompt editor with the default cleanup prompt.
- [ ] Add a separate hotkey option for "dictate with post-processing" only after the hotkey coordinator supports multiple bindings.
- [ ] Disable Apple Intelligence on Windows and unsupported macOS devices with a concrete unavailable state.

Run:

```bash
pnpm --filter @topo/desktop run test
pnpm run check
```

Expected: desktop tests and full check pass.

Commit:

```bash
git add apps/desktop/renderer
git commit -m "feat(settings): add post processing tab"
```

### Task 9: macOS Runtime Path

**Files:**

- Create `packages/native-bridge/src/apple-intelligence-service.ts`
- Create `apps/desktop/electron/macos-apple-intelligence.ts`
- Create `apps/desktop/electron/macos-permissions.ts`
- Create `apps/desktop/electron/apple-intelligence-bridge.ts`
- Modify `apps/desktop/electron/main.ts`
- Modify `apps/desktop/electron/ipc-handlers.ts`

- [ ] Add macOS platform detection to expose Apple Intelligence availability only on macOS devices that can support it.
- [ ] Keep Apple Intelligence calls on-device and behind explicit user selection.
- [ ] Implement the bridge method consumed by the AI SDK wrapper: `generateAppleIntelligenceText({ systemPrompt, prompt, maxTokens })`.
- [ ] Return structured availability reasons: `available`, `device-not-eligible`, `apple-intelligence-disabled`, `model-not-ready`, and `unknown`.
- [ ] Add permission/readiness state for accessibility and input monitoring.
- [ ] Treat WhisperKit as a system/local runtime in the catalog until a packaged helper exists.
- [ ] If a Swift helper is required, model it as a runtime pack or bundled helper with the same probe/readiness mechanism used by `whisper.cpp`.

Run:

```bash
pnpm --filter @topo/native-bridge run test
pnpm --filter @topo/desktop run test
pnpm run check
```

Expected: native bridge and desktop tests pass on Windows; macOS-specific tests should be unit-level and skip native execution outside macOS.

Commit:

```bash
git add packages/native-bridge apps/desktop/electron
git commit -m "feat(macos): add local post processing readiness"
```

### Task 10: Final Verification and Manual Smoke

**Files:**

- No planned source edits unless verification reveals issues.

- [ ] Run `pnpm run check`.
- [ ] Run `pnpm run test`.
- [ ] Run `pnpm --filter @topo/desktop run build`.
- [ ] On Windows, install a `whisper.cpp` runtime pack and `whisper-cpp-small`; confirm readiness is green only after both are verified.
- [ ] On Windows, verify toggle-to-talk still works.
- [ ] On Windows, verify push-to-talk starts on down and stops on release using the native hook path.
- [ ] On macOS, verify runtime recommendations do not offer Windows runtime packs.
- [ ] On macOS, verify Apple Intelligence appears only when supported and selected explicitly.
- [ ] Verify API post-processing can use OpenAI and OpenRouter via AI SDK-compatible provider configuration.

Commit verification fixes only if necessary:

```bash
git add <changed-files>
git commit -m "fix(desktop): stabilize install flow readiness"
```

## Open Decisions

- Runtime distribution source: decide whether to host signed runtime packs or download upstream release artifacts directly. For reliability and checksum control, prefer hosted signed packs.
- Windows native key hook: decide between a tiny native helper and a Node native addon. Prefer a helper process if it keeps Electron dependency installation simpler.
- macOS ASR runtime: decide whether initial macOS support is WhisperKit, `whisper.cpp` Metal, or both. The plan supports both, but first-run setup should recommend exactly one.
- Secret storage: Electron safeStorage is adequate for local encryption, but cross-machine migration should not expose API keys.
- Model catalog source: start bundled/static, then move to a signed remote manifest when the install flow is stable.

## Risks

- `whisper.cpp` release artifacts vary by platform and acceleration build. Runtime pack metadata must be pinned and probed.
- True push-to-talk cannot be implemented reliably with Electron `globalShortcut` alone.
- Apple Intelligence APIs and availability can change by macOS version and hardware; gate with runtime checks.
- AI post-processing can change user text meaning; default prompts must preserve meaning and post-processing should be opt-in.
- The Apple Intelligence wrapper must degrade cleanly when the system model is unavailable; remote API providers should not become an automatic fallback without explicit user selection.
- Large downloads need resumability eventually. The first pass can safely restart failed downloads, but should avoid leaving corrupt partial files.

## Completion Definition

The install flow is complete when:

- A fresh Windows install can install both runtime and model from setup with one user action.
- A fresh macOS install recommends only supported macOS options.
- Models show speed, accuracy, language, size, and memory information.
- Readiness accurately reflects model artifact plus runtime artifact plus runtime probe.
- Push-to-talk uses real key down/up events where native support is available.
- Post-processing is configured in a separate tab with local lightweight, AI SDK-wrapped Apple Intelligence, OpenAI, and OpenRouter paths.
- `pnpm run check` passes.
