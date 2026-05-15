# Windows Whisper GPU Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Windows whisper.cpp GPU usage with automatic CPU fallback so Topo prefers acceleration when available but never blocks dictation on GPU/runtime failure.

**Architecture:** Keep models downloaded separately from the app/runtime. Add catalog support for separate CPU and CUDA Windows whisper.cpp runtimes from official upstream release assets, expose an accelerator preference in settings, resolve/probe the preferred runtime, and retry transcription once with CPU when GPU execution fails. CPU remains the guaranteed baseline.

**Tech Stack:** Electron main process, TypeScript, Effect, whisper.cpp `whisper-cli`, existing model/runtime catalog and installer services, React settings/model UI.

---

## File Structure

- Modify `packages/contracts/src/settings.ts`: add `whisperCppAccelerator` setting.
- Modify `packages/settings/src/settings-schema.ts`: re-export validation through the existing settings schema.
- Modify `packages/model-catalog/src/runtime-catalog.ts`: add CPU/CUDA runtime IDs and metadata.
- Modify `packages/model-catalog/src/model-catalog.ts`: allow Whisper models to satisfy either Windows CPU or Windows GPU runtime.
- Modify `apps/desktop/electron/whisper-cpp-runtime.ts`: resolve runtimes by accelerator preference and return accelerator metadata.
- Modify `apps/desktop/electron/model-readiness.ts`: include GPU/CPU readiness messaging.
- Modify `packages/asr/src/local-ai-sdk-provider.ts`: add accelerator-aware args and retry-once CPU fallback.
- Modify `apps/desktop/electron/ipc-handlers.ts`: pass settings accelerator preference into ASR provider options.
- Modify `apps/desktop/renderer/src/features/settings/settings-page.tsx`: add accelerator setting control.
- Modify `apps/desktop/renderer/src/features/models/model-card.tsx`: show selected/runtime accelerator status.
- Add or update tests next to each touched module.

## Runtime Policy

- `auto`: prefer GPU on Windows when a verified CUDA runtime is installed and passes probe; otherwise use CPU.
- `gpu`: require GPU runtime for readiness, but transcription still retries CPU if the GPU process fails and CPU runtime is available.
- `cpu`: always use CPU runtime.
- The model file is shared. Only runtime choice changes.
- Runtimes are app-managed artifacts under the existing runtime install root. Models remain app-managed model artifacts under the existing model install root.
- Managed Windows GPU support is NVIDIA-only because official upstream whisper.cpp release assets publish CUDA builds, not Windows Vulkan builds. Non-NVIDIA users should see a clear model/runtime message: `Managed GPU acceleration for this model currently requires an NVIDIA GPU. AMD and Intel GPU acceleration are not supported yet; use CPU or provide a custom whisper.cpp runtime.`
- TODO later: support Windows Vulkan GPU runtimes when there is an acceptable non-Topo-hosted source, preferably an official upstream `ggml-org/whisper.cpp` Windows Vulkan release asset. Until then, Vulkan is custom-runtime only.

## Task 1: Settings Contract

**Files:**
- Modify: `packages/contracts/src/settings.ts`
- Test: `packages/contracts/src/settings.test.ts`
- Test: `packages/settings/src/settings-schema.test.ts`

- [ ] Add a settings enum:

```ts
export const WhisperCppAccelerator = Schema.Literal("auto", "cpu", "gpu");
export type WhisperCppAccelerator = typeof WhisperCppAccelerator.Type;
```

- [ ] Add `whisperCppAccelerator: WhisperCppAccelerator` to `AppSettings`.

- [ ] Set default:

```ts
whisperCppAccelerator: "auto",
```

- [ ] Add tests that unknown/missing settings decode to the default-compatible shape and that `"auto"`, `"cpu"`, and `"gpu"` are accepted while `"cuda"` is rejected.

- [ ] Run:

```sh
pnpm --filter @topo/contracts test
pnpm --filter @topo/settings test
```

- [ ] Commit:

```sh
git add packages/contracts packages/settings
git commit -m "feat: add whisper accelerator setting"
```

## Task 2: Windows Runtime Catalog

**Files:**
- Modify: `packages/model-catalog/src/runtime-catalog.ts`
- Modify: `packages/model-catalog/src/model-catalog.ts`
- Test: `packages/model-catalog/src/*.test.ts`

- [ ] Replace the single Windows runtime with two runtime IDs:

```ts
export type RuntimeId =
  | "whisperkit"
  | "whisper-cpp-windows-x64-cpu"
  | "whisper-cpp-windows-x64-cuda"
  | "whisper-cpp-macos-arm64";
```

- [ ] Add optional runtime accelerator metadata:

```ts
export type RuntimeAccelerator = "cpu" | "cuda" | "metal" | "system";

export interface RuntimeCatalogEntry {
  readonly accelerator: RuntimeAccelerator;
  // keep existing fields
}
```

- [ ] Add catalog entries:

```ts
{
  id: "whisper-cpp-windows-x64-cpu",
  displayName: "Whisper.cpp Windows x64 CPU",
  engine: "whisper-cpp",
  platform: "windows",
  architecture: "x64",
  accelerator: "cpu",
  version: "1.8.2",
  source: { type: "direct-url", url: "https://example.invalid/runtimes/whisper-cpp-windows-x64-cpu.zip" },
  checksumSha256: null,
  downloadSizeBytes: 0,
  diskSizeBytes: 0,
  binaryRelativePath: "whisper-cli.exe",
  probeArgs: ["--help"],
}
```

```ts
{
  id: "whisper-cpp-windows-x64-cuda",
  displayName: "Whisper.cpp Windows x64 CUDA",
  engine: "whisper-cpp",
  platform: "windows",
  architecture: "x64",
  accelerator: "cuda",
  version: "1.8.2",
  source: { type: "direct-url", url: "https://github.com/ggml-org/whisper.cpp/releases/download/v1.8.4/whisper-cublas-12.4.0-bin-x64.zip" },
  checksumSha256: null,
  downloadSizeBytes: 0,
  diskSizeBytes: 0,
  binaryRelativePath: "whisper-cli.exe",
  probeArgs: ["--help"],
}
```

- [ ] Update `whisper-cpp-small.runtimeRequirement.supportedRuntimeIds`:

```ts
supportedRuntimeIds: ["whisper-cpp-windows-x64-cuda", "whisper-cpp-windows-x64-cpu"]
```

- [ ] Keep old dev smoke model compatible with both new runtime IDs.

- [ ] Run:

```sh
pnpm --filter @topo/model-catalog test
```

- [ ] Commit:

```sh
git add packages/model-catalog
git commit -m "feat: catalog windows whisper runtimes"
```

## Task 3: Runtime Resolution and Probe

**Files:**
- Modify: `apps/desktop/electron/whisper-cpp-runtime.ts`
- Modify: `apps/desktop/electron/whisper-cpp-runtime.test.ts`
- Modify: `apps/desktop/electron/model-readiness.ts`
- Modify: `apps/desktop/electron/model-readiness.test.ts`

- [ ] Extend resolver input:

```ts
export interface WhisperCppRuntimeResolverOptions {
  readonly resourcesRoot: string;
  readonly installedBinaryPath?: string | null;
  readonly preferredAccelerator?: "auto" | "cpu" | "gpu";
  readonly installedRuntimes?: readonly InstalledRuntimeRecord[];
  readonly env?: NodeJS.ProcessEnv;
  readonly probe?: RuntimeProbe;
}
```

- [ ] Extend available result:

```ts
export interface WhisperCppRuntimeAvailable {
  readonly status: "available";
  readonly binaryPath: string;
  readonly source: WhisperCppRuntimeSource;
  readonly accelerator: "cpu" | "gpu";
  readonly runtimeId: string | null;
  readonly probeOutput: string;
  readonly checkedAt: string;
}
```

- [ ] Candidate order:

```ts
auto: installed CUDA, bundled CUDA, installed CPU, bundled CPU, env, PATH
gpu: installed CUDA, bundled CUDA, env, PATH
cpu: installed CPU, bundled CPU, env, PATH
```

- [ ] Probe the candidate with `--help` only for existence/launch. Do not run an actual transcription in readiness.

- [ ] Readiness messages:

```text
Model and whisper.cpp GPU runtime are ready.
Model and whisper.cpp CPU runtime are ready.
GPU runtime is unavailable; CPU fallback is ready.
```

- [ ] Tests:
  - `auto` picks GPU when GPU and CPU are both verified.
  - `auto` picks CPU when GPU probe fails.
  - `gpu` reports runtime failure when GPU probe fails.
  - `cpu` ignores a working GPU runtime.
  - non-NVIDIA messaging is present for managed CUDA GPU runtime cards/readiness.

- [ ] Run:

```sh
pnpm --filter @topo/desktop test -- whisper-cpp-runtime model-readiness
```

- [ ] Commit:

```sh
git add apps/desktop/electron/whisper-cpp-runtime.ts apps/desktop/electron/whisper-cpp-runtime.test.ts apps/desktop/electron/model-readiness.ts apps/desktop/electron/model-readiness.test.ts
git commit -m "feat: resolve whisper runtime by accelerator"
```

## Task 4: Transcription Fallback

**Files:**
- Modify: `packages/asr/src/local-ai-sdk-provider.ts`
- Test: `packages/asr/src/local-ai-sdk-provider.test.ts`
- Modify: `apps/desktop/electron/ipc-handlers.ts`
- Test: `apps/desktop/electron/ipc-handlers.test.ts`

- [ ] Add provider options:

```ts
export interface TopoTranscriptionModelOptions {
  readonly language?: LocalAiSdkTranscriptionLanguage | null;
  readonly installedModelPath?: string | null;
  readonly runtimeBinaryPath?: string | null;
  readonly fallbackRuntimeBinaryPath?: string | null;
  readonly accelerator?: "auto" | "cpu" | "gpu" | null;
  readonly audioPath?: string | null;
}
```

- [ ] Build whisper.cpp args:

```ts
const args = ["-m", options.installedModelPath, "-f", options.audioPath, "-otxt", "-np"];

if (options.accelerator === "cpu") {
  args.push("--no-gpu");
}
```

- [ ] In `auto` and `gpu`, if the first command fails and `fallbackRuntimeBinaryPath` exists, retry once with the fallback binary and `--no-gpu`.

- [ ] Mark fallback in response body:

```ts
body: {
  stderr: result.stderr,
  accelerator: usedFallback ? "cpu-fallback" : options.accelerator,
}
```

- [ ] Do not retry when:
  - the first command succeeded but output text is empty
  - the setting is `cpu`
  - no fallback runtime exists
  - the abort signal is already aborted

- [ ] Electron should pass:
  - selected accelerator from settings
  - chosen runtime path as `runtimeBinaryPath`
  - CPU runtime path as `fallbackRuntimeBinaryPath` when the chosen runtime is GPU

- [ ] Tests:
  - GPU success calls runner once.
  - GPU failure retries CPU and returns CPU text.
  - CPU setting never retries.
  - abort does not produce a fallback retry.

- [ ] Run:

```sh
pnpm --filter @topo/asr test -- local-ai-sdk-provider
pnpm --filter @topo/desktop test -- ipc-handlers
```

- [ ] Commit:

```sh
git add packages/asr apps/desktop/electron
git commit -m "feat: fallback whisper gpu failures to cpu"
```

## Task 5: Settings and Model UI

**Files:**
- Modify: `apps/desktop/renderer/src/features/settings/settings-page.tsx`
- Modify: `apps/desktop/renderer/src/features/models/model-card.tsx`
- Test: renderer tests if present; otherwise cover with typecheck and desktop tests.

- [ ] Add a compact settings row in local transcription settings:

```tsx
<NativeSelect
  value={settings?.whisperCppAccelerator ?? "auto"}
  onChange={(event) => updateSettings("whisperCppAccelerator", event.target.value)}
>
  <option value="auto">Auto</option>
  <option value="gpu">GPU</option>
  <option value="cpu">CPU</option>
</NativeSelect>
```

- [ ] Use plain copy:

```text
Auto uses GPU when the Windows CUDA runtime is ready and falls back to CPU if it fails.
```

- [ ] In `ModelCard`, display runtime readiness as:
  - `GPU ready`
  - `CPU ready`
  - `GPU unavailable; CPU fallback ready`
  - `Managed GPU acceleration for this model currently requires an NVIDIA GPU. AMD and Intel GPU acceleration are not supported yet; use CPU or provide a custom whisper.cpp runtime.`
  - existing runtime missing/failed labels otherwise.

- [ ] Keep install actions unchanged. Installing a model bundle should install the preferred runtime and CPU fallback when preference is `auto` or `gpu`.

- [ ] Run:

```sh
pnpm --filter @topo/desktop test
pnpm run check
```

- [ ] Commit:

```sh
git add apps/desktop/renderer
git commit -m "feat: expose whisper accelerator setting"
```

## Task 6: Bundle Install Semantics

**Files:**
- Modify: `apps/desktop/electron/install-plan.ts`
- Modify: `apps/desktop/electron/install-plan.test.ts`
- Modify: `apps/desktop/electron/model-catalog-service.ts`
- Test: `apps/desktop/electron/model-catalog-service.test.ts`

- [ ] When installing a Windows whisper.cpp model:
  - `cpu` installs CPU runtime only.
  - `gpu` installs GPU runtime and CPU runtime fallback.
  - `auto` installs GPU runtime and CPU runtime fallback.

- [ ] If GPU runtime install fails during `auto`, continue with CPU runtime install and mark bundle usable with warning.

- [ ] If GPU runtime install fails during `gpu`, mark runtime install failed but keep CPU fallback if it installed.

- [ ] Model install should never be rolled back because optional GPU runtime failed in `auto`.

- [ ] Tests:
  - `auto` bundle plans both runtimes.
  - `cpu` bundle plans only CPU runtime.
  - `gpu` bundle plans GPU plus CPU fallback.
  - `auto` GPU failure leaves CPU-ready readiness.

- [ ] Run:

```sh
pnpm --filter @topo/desktop test -- install-plan model-catalog-service runtime-install-job
```

- [ ] Commit:

```sh
git add apps/desktop/electron
git commit -m "feat: install cpu fallback with gpu runtime"
```

## Task 7: Final Verification

- [ ] Run focused tests:

```sh
pnpm --filter @topo/contracts test
pnpm --filter @topo/settings test
pnpm --filter @topo/model-catalog test
pnpm --filter @topo/asr test
pnpm --filter @topo/desktop test
```

- [ ] Run project gate:

```sh
pnpm run check
```

- [ ] Manual Windows smoke checklist:
  - Install CPU runtime and model.
  - Set accelerator to `cpu`, transcribe successfully.
  - Install CUDA GPU runtime and CPU runtime on an NVIDIA Windows machine.
  - Set accelerator to `auto`, confirm readiness says GPU ready.
  - Force GPU runtime failure by selecting a bad GPU binary, confirm dictation retries CPU.
  - Set accelerator to `gpu` with bad GPU binary, confirm readiness reports GPU failure while CPU fallback remains visible.
  - On a non-NVIDIA Windows machine, confirm the model/runtime UI says managed GPU acceleration requires NVIDIA and recommends CPU or a custom runtime.

- [ ] Commit any verification-only fixes with conventional commit messages.

## Self-Review

- Spec coverage: Windows install/runtime, GPU preference, CPU fallback, model/runtime separation, readiness, UI, tests, and final verification are covered.
- Placeholder scan: Runtime URLs and checksums remain catalog values sourced from official upstream release assets. The only TODO is the explicit future Vulkan support note requested for later work.
- Type consistency: Settings use `whisperCppAccelerator`; runtime catalog uses CPU/CUDA runtime IDs; ASR provider uses `fallbackRuntimeBinaryPath`.
