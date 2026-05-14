# WhisperKit Model Installation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add macOS WhisperKit model installation using a remotely updateable model manifest, so Topo can install new model artifacts from GitHub without shipping a new app build.

**Architecture:** Keep the bundled catalog as the offline fallback, then layer a validated remote manifest over it at app startup. Extend the existing model installer from single-file artifacts to directory archives, because WhisperKit models are model folders rather than `.bin` files. Treat actual WhisperKit transcription as a follow-up bridge task; this plan makes the model discoverable, downloadable, verified, recorded, and readiness-visible.

**Tech Stack:** Electron main process, Effect TS, Effect Schema, SQLite installed model records, streamed downloads, `extract-zip`, SHA-256 verification, GitHub raw or GitHub Releases hosted manifest/artifacts, and Handy's directory-model downloader as the operational reference.

---

## Current State

Topo already has a macOS `whisperkit-small` entry in `packages/model-catalog/src/model-catalog.ts`, but it uses `source.type === "huggingface-snapshot"`. `apps/desktop/electron/model-install-job.ts` rejects snapshot models, so the card can exist but the model cannot be installed.

The current model installer assumes every model is a single file installed at:

```text
<userData>/models/<model-id>/<model-id>.bin
```

WhisperKit needs a directory install target:

```text
<userData>/models/<model-id>/
```

Handy reference findings from `.local/Handy/src-tauri/src/managers/model.rs`:

- `ModelInfo.is_directory` selects file-vs-directory installation.
- Directory models download an archive to `<filename>.partial`.
- The archive is checksum verified before extraction.
- Extraction happens in `<filename>.extracting`.
- A completed extraction is renamed atomically to the final model directory.
- `get_model_path` returns a directory only if the final directory exists and no partial file is present.
- Handy supports resumable downloads with HTTP Range; Topo can defer that hardening because Topo already has streamed downloads and cancellation.

## Scope

In scope:

- Versioned manifest file format.
- Bundled local manifest file in the repo.
- Remote manifest loading, validation, cache, and fallback.
- Archive-directory model install strategy.
- WhisperKit model catalog entry using an archive artifact.
- Readiness support for installed macOS WhisperKit models.
- Tests for manifest parsing, fallback, archive installation, installed path, and readiness.

Out of scope for this plan:

- Swift WhisperKit transcription helper.
- Hugging Face recursive snapshot download.
- Signed manifests.
- Delta updates or background auto-update.
- Resumable model downloads.

## Target User Flow

1. App starts on macOS arm64.
2. Electron loads bundled model catalog.
3. Electron tries to fetch the remote model manifest.
4. If the remote manifest is valid, it is merged over the bundled catalog and cached.
5. If fetch or validation fails, Electron uses the last valid cached manifest.
6. If no cache exists, Electron uses the bundled catalog.
7. User clicks install for `WhisperKit Small`.
8. Topo downloads the zip artifact, verifies size and SHA-256, extracts to `.extracting`, validates required model files, and atomically moves the directory into the model install root.
9. Topo records an `InstalledModelRecord` whose `installedPath` is the model directory.
10. Model readiness shows the model as ready on macOS when the model directory is verified.

## File Structure

- Create `manifests/model-catalog.v1.json`  
  Bundled manifest source that can also be published through GitHub raw content.

- Create `packages/model-catalog/src/model-manifest.ts`  
  Effect Schema definitions and conversion helpers from manifest JSON to `ModelCatalogEntry[]`.

- Modify `packages/model-catalog/src/download-source.ts`  
  Keep existing source types; use `github-release` or `direct-url` for first WhisperKit archives instead of `huggingface-snapshot`.

- Modify `packages/model-catalog/src/model-catalog.ts`  
  Add install strategy metadata to `ModelCatalogEntry`, and change `whisperkit-small` to an archive-directory artifact once a real artifact URL and checksum exist.

- Modify `packages/model-catalog/src/model-installation.ts`  
  Make install plans represent either a single file or an archive directory.

- Create `apps/desktop/electron/model-catalog-service.ts`  
  Fetch, validate, cache, and merge remote manifests.

- Modify `apps/desktop/electron/main.ts`  
  Replace the static `getBundledModelCatalog()` call with the catalog service.

- Modify `apps/desktop/electron/model-install-job.ts`  
  Add archive-directory installation using the same extraction style as `runtime-install-job.ts`.

- Modify `apps/desktop/electron/model-readiness.ts`  
  Treat installed WhisperKit directory models as ready on macOS without requiring a downloaded runtime pack.

- Modify `apps/desktop/electron/ipc-handlers.ts`  
  Record directory install paths correctly and preserve source revision for update detection.

- Add or modify tests in:
  - `packages/model-catalog/src/model-manifest.test.ts`
  - `packages/model-catalog/src/model-installation.test.ts`
  - `apps/desktop/electron/model-catalog-service.test.ts`
  - `apps/desktop/electron/model-install-job.test.ts`
  - `apps/desktop/electron/model-readiness.test.ts`

## Manifest Contract

Use this v1 shape:

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-05-14T00:00:00.000Z",
  "models": [
    {
      "id": "whisperkit-small",
      "displayName": "WhisperKit Small",
      "runtime": "whisperkit",
      "runtimeRequirement": {
        "engine": "whisperkit",
        "supportedRuntimeIds": ["whisperkit"]
      },
      "platforms": ["macos"],
      "architectures": ["arm64"],
      "languages": ["en", "ru"],
      "source": {
        "type": "github-release",
        "owner": "topo-app",
        "repo": "topo-models",
        "tag": "whisperkit-small-2026-05-14",
        "assetName": "whisperkit-small.zip"
      },
      "installStrategy": {
        "type": "archive-directory",
        "requiredFiles": ["config.json"]
      },
      "checksumSha256": "replace-with-real-archive-sha256",
      "downloadSizeBytes": 536870912,
      "diskSizeBytes": 1288490189,
      "estimatedMemoryBytes": 1932735283,
      "qualityLabel": "balanced",
      "speedLabel": "fast",
      "accuracyScore": 72,
      "speedScore": 78,
      "recommendedReason": "Recommended for Apple Silicon because it balances latency and accuracy.",
      "badges": ["recommended"],
      "experimental": false
    }
  ]
}
```

The first production artifact should be a zip file from GitHub Releases or another stable direct URL. Do not use Hugging Face snapshot recursion in this implementation slice.

## Implementation Slices

### Task 1: Manifest Schema and Conversion

**Files:**

- Create `packages/model-catalog/src/model-manifest.ts`
- Create `packages/model-catalog/src/model-manifest.test.ts`
- Modify `packages/model-catalog/src/index.ts`

- [ ] **Step 1: Write schema tests**

Add tests that decode a valid v1 manifest, reject unsupported `schemaVersion`, reject missing checksums, and convert manifest models into catalog entries.

Run:

```bash
pnpm --filter @topo/model-catalog run test -- model-manifest
```

Expected: fail because `model-manifest.ts` does not exist yet.

- [ ] **Step 2: Implement `ModelCatalogManifest` schema**

Define:

```ts
export const ModelInstallStrategy = Schema.Union(
  Schema.Struct({ type: Schema.Literal("single-file") }),
  Schema.Struct({
    type: Schema.Literal("archive-directory"),
    requiredFiles: Schema.Array(Schema.String),
  }),
);

export const ModelCatalogManifest = Schema.Struct({
  schemaVersion: Schema.Literal(1),
  generatedAt: Schema.String,
  models: Schema.Array(ManifestModelCatalogEntry),
});
```

Use existing catalog field names where possible so conversion is shallow and type-safe.

- [ ] **Step 3: Export manifest helpers**

Export the new schema and helpers from `packages/model-catalog/src/index.ts`.

- [ ] **Step 4: Run tests**

Run:

```bash
pnpm --filter @topo/model-catalog run test -- model-manifest
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add packages/model-catalog/src/model-manifest.ts packages/model-catalog/src/model-manifest.test.ts packages/model-catalog/src/index.ts
git commit -m "feat(model-catalog): add model manifest schema"
```

### Task 2: Bundled Manifest File

**Files:**

- Create `manifests/model-catalog.v1.json`
- Modify `packages/model-catalog/src/model-catalog.test.ts`

- [ ] **Step 1: Add fixture validation test**

Add a test that reads `manifests/model-catalog.v1.json`, decodes it with `ModelCatalogManifest`, and verifies that every model id is unique.

Run:

```bash
pnpm --filter @topo/model-catalog run test -- model-catalog
```

Expected: fail because the manifest file does not exist.

- [ ] **Step 2: Create the bundled manifest**

Add `manifests/model-catalog.v1.json` with the current `whisperkit-small` metadata and a placeholder archive URL that points to a controlled invalid host until the real artifact is published:

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-05-14T00:00:00.000Z",
  "models": [
    {
      "id": "whisperkit-small",
      "displayName": "WhisperKit Small",
      "runtime": "whisperkit",
      "runtimeRequirement": {
        "engine": "whisperkit",
        "supportedRuntimeIds": ["whisperkit"]
      },
      "platforms": ["macos"],
      "architectures": ["arm64"],
      "languages": ["en", "ru"],
      "source": {
        "type": "direct-url",
        "url": "https://example.invalid/models/whisperkit-small.zip"
      },
      "installStrategy": {
        "type": "archive-directory",
        "requiredFiles": ["config.json"]
      },
      "checksumSha256": "0000000000000000000000000000000000000000000000000000000000000001",
      "downloadSizeBytes": 536870912,
      "diskSizeBytes": 1288490189,
      "estimatedMemoryBytes": 1932735283,
      "qualityLabel": "balanced",
      "speedLabel": "fast",
      "accuracyScore": 72,
      "speedScore": 78,
      "recommendedReason": "Recommended for Apple Silicon because it balances latency and accuracy.",
      "badges": ["recommended"],
      "experimental": false
    }
  ]
}
```

- [ ] **Step 3: Run tests**

Run:

```bash
pnpm --filter @topo/model-catalog run test -- model-catalog
```

Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add manifests/model-catalog.v1.json packages/model-catalog/src/model-catalog.test.ts
git commit -m "feat(model-catalog): add bundled model manifest"
```

### Task 3: Catalog Service With Remote Fetch and Cache

**Files:**

- Create `apps/desktop/electron/model-catalog-service.ts`
- Create `apps/desktop/electron/model-catalog-service.test.ts`
- Modify `apps/desktop/electron/main.ts`

- [ ] **Step 1: Write fallback tests**

Cover:

- valid remote manifest overrides bundled model by id
- invalid remote manifest falls back to cached manifest
- failed fetch without cache falls back to bundled catalog
- successful remote manifest writes cache

Run:

```bash
pnpm --filter @topo/desktop run test -- model-catalog-service
```

Expected: fail because the service does not exist.

- [ ] **Step 2: Implement `createModelCatalogService`**

The service should accept:

```ts
interface ModelCatalogServiceOptions {
  readonly bundledCatalog: readonly ModelCatalogEntry[];
  readonly cachePath: string;
  readonly manifestUrl: string | null;
  readonly fetch: typeof fetch;
}
```

Expose:

```ts
interface ModelCatalogService {
  readonly load: () => Effect.Effect<readonly ModelCatalogEntry[], never>;
}
```

Merge remote over bundled by `id`, preserving bundled entries that are absent from the remote manifest.

- [ ] **Step 3: Wire `main.ts`**

In `apps/desktop/electron/main.ts`, replace the static catalog construction with:

```ts
const bundledCatalog = getBundledModelCatalog({ includeDev: !app.isPackaged });
const catalog = await Effect.runPromise(
  createModelCatalogService({
    bundledCatalog,
    cachePath: join(userDataDirectory, "model-catalog.v1.json"),
    manifestUrl: process.env.TOPO_MODEL_MANIFEST_URL ?? null,
    fetch,
  }).load(),
);
```

Keep `TOPO_MODEL_MANIFEST_URL` optional so local development and tests stay deterministic.

- [ ] **Step 4: Run tests**

Run:

```bash
pnpm --filter @topo/desktop run test -- model-catalog-service
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/electron/model-catalog-service.ts apps/desktop/electron/model-catalog-service.test.ts apps/desktop/electron/main.ts
git commit -m "feat(desktop): load model catalog manifest"
```

### Task 4: Install Strategy in Model Install Plans

**Files:**

- Modify `packages/model-catalog/src/model-catalog.ts`
- Modify `packages/model-catalog/src/model-installation.ts`
- Modify `packages/model-catalog/src/model-installation.test.ts`

- [ ] **Step 1: Write install plan tests**

Add tests for:

- `single-file` model plan keeps existing `<model-id>.bin` path
- `archive-directory` model plan returns `installDirectory` as the final installed path
- `verifyDownloadedModel` still verifies the downloaded archive by size and checksum before extraction

Run:

```bash
pnpm --filter @topo/model-catalog run test -- model-installation
```

Expected: fail because `installStrategy` is not modeled yet.

- [ ] **Step 2: Add `installStrategy` to `ModelCatalogEntry`**

Add:

```ts
export type ModelInstallStrategy =
  | { readonly type: "single-file" }
  | {
      readonly type: "archive-directory";
      readonly requiredFiles: readonly string[];
    };
```

Set existing `.bin` models to `{ type: "single-file" }`.

- [ ] **Step 3: Extend `ModelInstallPlan`**

Add:

```ts
readonly installStrategy: ModelInstallStrategy;
readonly installedPath: string;
readonly archivePath: string | null;
```

For `single-file`, `installedPath` remains the model file path. For `archive-directory`, `installedPath` is `installDirectory` and `archivePath` is `<installDirectory>/<model-id>.zip.download`.

- [ ] **Step 4: Run tests**

Run:

```bash
pnpm --filter @topo/model-catalog run test -- model-installation
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add packages/model-catalog/src/model-catalog.ts packages/model-catalog/src/model-installation.ts packages/model-catalog/src/model-installation.test.ts
git commit -m "feat(model-catalog): model archive install plans"
```

### Task 5: Archive Directory Model Installer

**Files:**

- Modify `apps/desktop/electron/model-install-job.ts`
- Modify `apps/desktop/electron/model-install-job.test.ts`

- [ ] **Step 1: Write archive installer tests**

Cover:

- downloads archive to `.download`
- verifies checksum before extraction
- extracts into `.extracting`
- validates each `requiredFiles` entry
- renames extraction output to final install directory
- records progress status as `installing` during extraction
- removes `.download` and `.extracting` on failure

Run:

```bash
pnpm --filter @topo/desktop run test -- model-install-job
```

Expected: fail because archive-directory install is not implemented.

- [ ] **Step 2: Add injectable archive extractor**

Add to `FileModelInstallJobOptions`:

```ts
readonly extractArchive?: (archivePath: string, targetDirectory: string) => Promise<void>;
```

Default implementation:

```ts
const defaultExtractArchive = async (archivePath: string, targetDirectory: string) => {
  const extract = (await import("extract-zip")).default;
  await extract(archivePath, { dir: targetDirectory });
};
```

- [ ] **Step 3: Implement archive install branch**

After download verification:

```ts
if (plan.installStrategy.type === "archive-directory") {
  await rm(extractingDirectory, { force: true, recursive: true });
  await mkdir(extractingDirectory, { recursive: true });
  await extractArchive(tempFilePath, extractingDirectory);
  await validateRequiredFiles(extractingDirectory, plan.installStrategy.requiredFiles);
  await rm(plan.installDirectory, { force: true, recursive: true });
  await rename(extractingDirectory, plan.installDirectory);
  await rm(tempFilePath, { force: true });
}
```

Use the final extracted directory directly. Do not try to infer nested archive structure in the first pass; instead require the zip root to contain the required files.

- [ ] **Step 4: Update `getInstalledModelPath`**

Return `plan.installedPath` for every model, so WhisperKit returns a directory and single-file models return the `.bin`.

- [ ] **Step 5: Run tests**

Run:

```bash
pnpm --filter @topo/desktop run test -- model-install-job
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/electron/model-install-job.ts apps/desktop/electron/model-install-job.test.ts
git commit -m "feat(desktop): install directory model archives"
```

### Task 6: Installed Record and Update Detection

**Files:**

- Modify `apps/desktop/electron/ipc-handlers.ts`
- Modify `apps/desktop/electron/ipc-handlers.test.ts` if present, otherwise add focused tests near existing install tests.

- [ ] **Step 1: Write installed path test**

Install an archive-directory model and assert the saved `InstalledModelRecord.installedPath` equals the final model directory, not a `.bin` path or source URL.

Run:

```bash
pnpm --filter @topo/desktop run test -- ipc-handlers
```

Expected: fail until `recordInstalledModel` uses the install plan installed path.

- [ ] **Step 2: Update `recordInstalledModel`**

Use:

```ts
installedPath: dependencies.modelInstallJob.getInstalledModelPath(model.id) ?? model.downloadUrl
```

This already exists, so verify the new installer path behavior makes the saved record correct.

- [ ] **Step 3: Add update helper**

Add a helper in `ipc-handlers.ts` or a small new file if tests need it:

```ts
const isInstalledModelOutdated = (
  installed: InstalledModelRecord,
  model: ModelCatalogEntry,
): boolean =>
  installed.sourceRevision !== sourceRevision(model) ||
  installed.checksumSha256 !== model.checksumSha256;
```

Do not expose UI update controls in this task. The helper makes later UI work straightforward.

- [ ] **Step 4: Run tests**

Run:

```bash
pnpm --filter @topo/desktop run test
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/electron/ipc-handlers.ts apps/desktop/electron
git commit -m "feat(desktop): track model artifact revisions"
```

### Task 7: WhisperKit Readiness

**Files:**

- Modify `apps/desktop/electron/model-readiness.ts`
- Modify `apps/desktop/electron/model-readiness.test.ts`

- [ ] **Step 1: Write readiness tests**

Add tests for:

- installed verified `whisperkit` model returns `ready`
- missing `whisperkit` model returns `not-installed`
- corrupt `whisperkit` model returns `not-installed` or existing corrupt-facing behavior

Run:

```bash
pnpm --filter @topo/desktop run test -- model-readiness
```

Expected: fail because non-`whisper-cpp` currently requires a verified runtime record or reports runtime not implemented.

- [ ] **Step 2: Add WhisperKit system runtime readiness**

In `computeModelReadiness`, before the generic non-`whisper-cpp` branch, add:

```ts
if (runtime === "whisperkit") {
  return {
    modelId,
    status: "ready",
    lamp: "green",
    message: "Model and WhisperKit runtime are ready.",
    runtimeBinaryPath: null,
    checkedAt: checkedAtFor(runtimeResult),
  };
}
```

This branch must only run after verified installed model check has passed.

- [ ] **Step 3: Run tests**

Run:

```bash
pnpm --filter @topo/desktop run test -- model-readiness
```

Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/electron/model-readiness.ts apps/desktop/electron/model-readiness.test.ts
git commit -m "feat(desktop): mark installed whisperkit models ready"
```

### Task 8: Real WhisperKit Artifact Metadata

**Files:**

- Modify `manifests/model-catalog.v1.json`
- Modify `packages/model-catalog/src/model-catalog.ts`

- [ ] **Step 1: Package the model artifact**

Create a zip whose root contains the WhisperKit model folder files directly. The app expects required files at the archive root after extraction.

Example expected archive contents:

```text
config.json
*.mlmodelc/
*.json
```

The exact required file list should be based on the produced WhisperKit model folder. Keep `config.json` in the required list if present.

- [ ] **Step 2: Publish the artifact**

Publish the zip to a GitHub Release, for example:

```text
https://github.com/topo-app/topo-models/releases/download/whisperkit-small-2026-05-14/whisperkit-small.zip
```

- [ ] **Step 3: Compute SHA-256 and size**

Run:

```bash
shasum -a 256 whisperkit-small.zip
stat -f %z whisperkit-small.zip
```

Expected: one SHA-256 hex digest and one byte size.

- [ ] **Step 4: Update manifest and bundled catalog**

Replace the placeholder direct URL, checksum, and size with the real GitHub Release source and artifact metadata.

- [ ] **Step 5: Run catalog tests**

Run:

```bash
pnpm --filter @topo/model-catalog run test
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add manifests/model-catalog.v1.json packages/model-catalog/src/model-catalog.ts
git commit -m "feat(model-catalog): add whisperkit model artifact"
```

### Task 9: Full Verification

**Files:**

- No planned source edits.

- [ ] **Step 1: Run model-catalog tests**

Run:

```bash
pnpm --filter @topo/model-catalog run test
```

Expected: pass.

- [ ] **Step 2: Run desktop tests**

Run:

```bash
pnpm --filter @topo/desktop run test
```

Expected: pass.

- [ ] **Step 3: Run full required check**

Run:

```bash
pnpm run check
```

Expected: pass.

- [ ] **Step 4: Manual macOS smoke test**

Run:

```bash
TOPO_MODEL_MANIFEST_URL=https://raw.githubusercontent.com/<owner>/<repo>/<branch>/manifests/model-catalog.v1.json pnpm dev
```

Expected:

- `WhisperKit Small` appears on macOS arm64.
- Install downloads the archive.
- Progress reaches installed.
- Installed model record points to `<userData>/models/whisperkit-small`.
- Readiness shows ready.
- Starting dictation can still fail until the separate WhisperKit transcription bridge is implemented.

- [ ] **Step 5: Commit verification-only fixes if needed**

If verification required code fixes, commit them:

```bash
git add <changed-files>
git commit -m "fix(desktop): stabilize whisperkit model installation"
```

## Follow-Up Plan

After this plan, create a separate plan for actual WhisperKit transcription:

- Swift helper target or embedded bridge that imports WhisperKit.
- IPC contract for transcribing a recorded WAV or PCM file.
- `packages/asr` provider for WhisperKit.
- Runtime selection in Electron based on selected model runtime.
- End-to-end dictation smoke test on macOS.

That bridge is required before `whisperkit-small` can transcribe real audio. This plan only installs and verifies the model artifact.

