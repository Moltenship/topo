# Logging Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add t3code-style structured logs and trace files to Topo so local failures, model behavior, IPC activity, installation progress, and state transitions can be debugged by a human or handed to an agent as a compact diagnostics bundle.

**Architecture:** Reuse the t3code pattern from `.local/t3code/apps/desktop/src/app/DesktopObservability.ts`, `.local/t3code/packages/shared/src/observability.ts`, and `.local/t3code/packages/shared/src/logging.ts`: Effect logs become trace events via `Logger.tracerLogger`, spans persist as rotating NDJSON, and component loggers attach stable annotations. Topo will keep the durable logging primitives in `@topo/shared`, add an Electron main observability module that configures the runtime and log directory, and instrument ASR/model behavior at package boundaries so logs stay useful without leaking transcript text or prompts by default.

**Tech Stack:** TypeScript, Electron, Effect `Logger`/`Tracer`/`Layer`, Node `fs`/`path`, Vitest, existing pnpm workspace scripts.

---

## Reference Findings

t3code does not use `electron-log`. Its useful behavior comes from these units:

- `.local/t3code/packages/shared/src/logging.ts`: synchronous `RotatingFileSink` with size-based rotation and backup pruning.
- `.local/t3code/packages/shared/src/observability.ts`: local file tracer, JSON normalization, trace sink batching, span serialization to NDJSON.
- `.local/t3code/apps/desktop/src/app/DesktopObservability.ts`: component logger helpers, desktop trace file at `logDir/desktop.trace.ndjson`, `Logger.tracerLogger`, minimum log level, trace timing, and separate child-process output log.
- `.local/t3code/apps/desktop/src/ipc/DesktopIpc.ts`: each IPC handler runs inside `Effect.withSpan(...)` and annotates the channel.
- `.local/t3code/apps/desktop/src/app/DesktopApp.ts`: one scoped run id is annotated into every log/span.

Topo currently has Effect-heavy ASR and Electron code but no app-wide logger. The highest-value surfaces are:

- `apps/desktop/electron/main.ts`
- `apps/desktop/electron/ipc-handlers.ts`
- `apps/desktop/electron/model-install-job.ts`
- `apps/desktop/electron/runtime-install-job.ts`
- `apps/desktop/electron/model-catalog-service.ts`
- `apps/desktop/electron/model-readiness.ts`
- `apps/desktop/electron/whisper-cpp-runtime.ts`
- `apps/desktop/electron/whisperkit-bridge.ts`
- `packages/asr/src/dictation-orchestrator.ts`
- `packages/asr/src/runtime-transcription-provider.ts`
- `packages/asr/src/whisper-cpp-provider.ts`
- `packages/asr/src/whisperkit-provider.ts`
- `packages/asr/src/post-processing-provider.ts`
- `packages/asr/src/apple-intelligence-ai-sdk-provider.ts`

## Logging Policy

Durable logs must be useful for debugging but safe to share:

- Include: run id, component, operation/span name, duration, status, model id, runtime, language, recording mode, audio duration, byte counts, install stages, readiness decisions, provider id, prompt id, token counts when available, warning/error codes, sanitized error name/message/stack.
- Exclude by default: transcript text, raw prompts, API keys, filesystem contents, full user home paths when a basename is enough, clipboard text, inserted text, and full audio payloads.
- Allow explicit debug-only text capture later through a setting or env flag, but do not include it in the initial implementation.

## Files and Responsibilities

- Create `packages/shared/src/logging.ts`: t3code-style `RotatingFileSink`, shared `LogLevel`, `LogAnnotations`, redaction/sanitization helpers, and path-safe helpers.
- Create `packages/shared/src/observability.ts`: t3code-style trace record types, `makeTraceSink`, `makeLocalFileTracer`, JSON normalization, and `makeComponentLogger`.
- Modify `packages/shared/src/index.ts`: export logging and observability APIs.
- Create `packages/shared/src/logging.test.ts`: verify rotation, backup pruning, non-throwing default writes, and redaction helpers.
- Create `packages/shared/src/observability.test.ts`: verify logs are recorded as span events and attributes are JSON-safe.
- Create `apps/desktop/electron/observability.ts`: Electron main logging configuration, log directory resolution, scoped run id, component logger factory, diagnostics manifest/export helpers, and trace flush hook.
- Create `apps/desktop/electron/observability.test.ts`: verify log directory resolution, trace file creation, diagnostics manifest shape, and redaction.
- Modify `apps/desktop/electron/main.ts`: initialize observability before app boot, annotate run/environment metadata, wrap startup in spans, log fatal startup errors, and flush traces on quit.
- Modify `apps/desktop/electron/ipc-handlers.ts`: add spans and component logs around public IPC actions, state publication, hotkey events, overlay transitions, dictation lifecycle, text insertion, settings updates, and install orchestration.
- Modify `apps/desktop/electron/model-install-job.ts` and `apps/desktop/electron/runtime-install-job.ts`: log download milestones, verification, extraction, install completion, cancellation, and failure with bytes and model/runtime ids.
- Modify `apps/desktop/electron/model-catalog-service.ts`, `apps/desktop/electron/model-readiness.ts`, `apps/desktop/electron/whisper-cpp-runtime.ts`, `apps/desktop/electron/whisperkit-bridge.ts`: log catalog source decisions, readiness probes, binary resolution, bridge availability, and probe failures.
- Modify `packages/asr/src/dictation-orchestrator.ts`: add lifecycle spans for session start, audio capture stop, transcription, post-processing, cleanup, and transcript record creation.
- Modify `packages/asr/src/runtime-transcription-provider.ts`, `packages/asr/src/whisper-cpp-provider.ts`, `packages/asr/src/whisperkit-provider.ts`: log runtime routing, model invocation start/end, durations, warnings, and provider failures.
- Modify `packages/asr/src/post-processing-provider.ts` and `packages/asr/src/apple-intelligence-ai-sdk-provider.ts`: log model behavior for cleanup generation, provider choice, model id, prompt id, finish reason, usage when available, latency, recoverable fallback, and unsupported streaming.
- Modify `packages/asr/src/*test.ts`: assert behavior still passes and instrumentation emits expected spans/log events through the shared tracer.
- Modify `apps/desktop/renderer/src/api/renderer-api.ts`, `packages/shared/src/index.ts`, `packages/contracts/src/ipc.ts`, and related tests only if adding a renderer-accessible diagnostics endpoint is chosen during implementation.

## Output Files

Initial implementation should write these files under `app.getPath("userData")/logs`:

- `topo.trace.ndjson`: structured spans and Effect log events. This is the primary agent-debuggable artifact.
- `topo-main.log`: optional plain/structured main-process fallback only for non-Effect exceptions that happen before the tracer is installed. If all startup code is inside the Effect runtime, this file may stay absent.
- `diagnostics-manifest.json`: compact metadata for support/agents: app version, platform, arch, packaged/dev, run id, active log paths, current settings with secrets removed, selected model id/runtime, installed model/runtime summaries, and latest error message.

Rotation defaults should match t3code unless a Topo-specific reason appears during implementation:

- `maxBytes = 10 * 1024 * 1024`
- `maxFiles = 10`
- trace batch window `200ms`

## Task 1: Shared Rotating File Sink

**Files:**
- Create: `packages/shared/src/logging.ts`
- Create: `packages/shared/src/logging.test.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Write failing tests for rotation and redaction**

Add `packages/shared/src/logging.test.ts`:

```ts
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { redactLogAnnotations, RotatingFileSink } from "./logging";

describe("RotatingFileSink", () => {
  it("rotates files and prunes backups", () => {
    const dir = mkdtempSync(join(tmpdir(), "topo-logging-"));
    const filePath = join(dir, "topo.trace.ndjson");
    const sink = new RotatingFileSink({ filePath, maxBytes: 10, maxFiles: 2, throwOnError: true });

    sink.write("123456789\n");
    sink.write("abcdefghi\n");
    sink.write("xyz\n");

    expect(readdirSync(dir).sort()).toEqual(["topo.trace.ndjson", "topo.trace.ndjson.1"]);
    expect(readFileSync(filePath, "utf8")).toBe("xyz\n");
  });
});

describe("redactLogAnnotations", () => {
  it("removes secrets and optionally hashes long text", () => {
    expect(
      redactLogAnnotations({
        apiKey: "secret",
        prompt: "Clean this transcript",
        text: "user transcript",
        modelId: "whisperkit-small",
      }),
    ).toEqual({
      apiKey: "[REDACTED]",
      promptLength: 21,
      textLength: 15,
      modelId: "whisperkit-small",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @topo/shared test -- logging.test.ts`

Expected: FAIL because `./logging` does not exist.

- [ ] **Step 3: Implement shared logging helpers**

Add `packages/shared/src/logging.ts` using the t3code `RotatingFileSink` structure with Topo names. Include:

- `RotatingFileSinkOptions`
- `RotatingFileSink`
- `LogAnnotations = Record<string, unknown>`
- `redactLogAnnotations(input: LogAnnotations): LogAnnotations`
- `sanitizeLogString(value: string): string`
- secret key detection for keys containing `key`, `token`, `secret`, `password`, `authorization`
- text field handling for keys `text`, `transcript`, `prompt`, `rawTranscript`, `clipboard`, `insertedText`

- [ ] **Step 4: Export APIs**

Append to `packages/shared/src/index.ts`:

```ts
export * from "./logging";
```

- [ ] **Step 5: Run focused test**

Run: `pnpm --filter @topo/shared test -- logging.test.ts`

Expected: PASS.

## Task 2: Shared Local File Tracer and Component Logger

**Files:**
- Create: `packages/shared/src/observability.ts`
- Create: `packages/shared/src/observability.test.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Write failing tests for trace events**

Add a test based on t3code’s `DesktopObservability.test.ts` that:

- creates a temp `topo.trace.ndjson`
- installs a local tracer and `Logger.tracerLogger`
- runs `Effect.logInfo("model selected")` inside `Effect.withSpan("topo.test.span")`
- flushes the sink
- asserts the NDJSON record has span name, attributes, and an event named `model selected`

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @topo/shared test -- observability.test.ts`

Expected: FAIL because `./observability` does not exist.

- [ ] **Step 3: Implement trace primitives**

Port the small, relevant subset from `.local/t3code/packages/shared/src/observability.ts`:

- `TraceRecord`, `TraceRecordEvent`, `TraceSink`, `TraceSinkOptions`
- `compactTraceAttributes`
- `spanToTraceRecord`
- `makeTraceSink`
- `makeLocalFileTracer`
- `makeComponentLogger(component: string)` returning `annotate`, `logDebug`, `logInfo`, `logWarning`, `logError`

Use `redactLogAnnotations` before attributes are written.

- [ ] **Step 4: Export APIs**

Append to `packages/shared/src/index.ts`:

```ts
export * from "./observability";
```

- [ ] **Step 5: Run focused test**

Run: `pnpm --filter @topo/shared test -- observability.test.ts`

Expected: PASS.

## Task 3: Electron Observability Runtime

**Files:**
- Create: `apps/desktop/electron/observability.ts`
- Create: `apps/desktop/electron/observability.test.ts`
- Modify: `apps/desktop/electron/main.ts`

- [ ] **Step 1: Write failing tests**

Test:

- `resolveLogDirectory({ userDataDirectory: "/tmp/topo" })` returns `/tmp/topo/logs`
- `makeDiagnosticsManifest(...)` redacts post-processing secrets
- running an Effect span with the desktop layer writes `topo.trace.ndjson`

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @topo/desktop test -- observability.test.ts`

Expected: FAIL because `observability.ts` does not exist.

- [ ] **Step 3: Implement `apps/desktop/electron/observability.ts`**

Include:

- constants: `TOPO_LOG_FILE_MAX_BYTES`, `TOPO_LOG_FILE_MAX_FILES`, `TOPO_TRACE_BATCH_WINDOW_MS`
- `resolveLogDirectory({ userDataDirectory })`
- `makeTopoRunId(now = new Date())`
- `makeDesktopObservabilityLayer({ logDir, runId, isPackaged, platform, arch })`
- `topoMainLogger = makeComponentLogger("electron-main")`
- `makeDiagnosticsManifest(input)` with redacted settings and log file paths
- `writeDiagnosticsManifest(path, manifest)` as an Effect

Layer behavior:

- `Logger.layer([Logger.consolePretty(), Logger.tracerLogger], { mergeWithExisting: false })`
- `References.MinimumLogLevel` set to `"Info"` by default, overridable with `TOPO_LOG_LEVEL`
- `Tracer.MinimumTraceLevel` set to `"Info"`
- `References.TracerTimingEnabled` set to `true`
- `Tracer.Tracer` from `makeLocalFileTracer`

- [ ] **Step 4: Wrap `main.ts` startup**

Refactor `app.whenReady().then(async () => { ... })` into:

```ts
const bootstrap = Effect.gen(function* () {
  // current main.ts setup
}).pipe(Effect.withSpan("topo.desktop.bootstrap"));
```

Initialize:

```ts
const userDataDirectory = app.getPath("userData");
const logDir = resolveLogDirectory({ userDataDirectory });
const runId = makeTopoRunId();
const observabilityLayer = makeDesktopObservabilityLayer({
  logDir,
  runId,
  isPackaged: app.isPackaged,
  platform: process.platform,
  arch: process.arch,
});
```

Run startup with:

```ts
await Effect.runPromise(
  Effect.scoped(
    Effect.gen(function* () {
      yield* Effect.annotateLogsScoped({ scope: "desktop", runId });
      yield* Effect.annotateCurrentSpan({ scope: "desktop", runId });
      yield* topoMainLogger.logInfo("desktop startup begin", { logDir });
      yield* bootstrap;
      yield* topoMainLogger.logInfo("desktop startup complete");
    }),
  ).pipe(Effect.provide(observabilityLayer)),
);
```

Catch startup errors and log `desktop startup failed` before rethrowing.

- [ ] **Step 5: Run focused test**

Run: `pnpm --filter @topo/desktop test -- observability.test.ts`

Expected: PASS.

## Task 4: IPC and App State Instrumentation

**Files:**
- Modify: `apps/desktop/electron/ipc-handlers.ts`
- Modify: `apps/desktop/electron/ipc-handlers.test.ts` if present, otherwise add targeted assertions to the most relevant existing Electron tests.

- [ ] **Step 1: Add IPC wrapper tests**

Test that an IPC handler failure logs the channel and error code/name without serializing payload text.

- [ ] **Step 2: Implement helper wrapper**

Add local helper:

```ts
const ipcLogger = makeComponentLogger("electron-ipc");

const withIpcSpan = <A, E, R>(
  channel: string,
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> =>
  effect.pipe(
    ipcLogger.annotate({ channel }),
    Effect.tapError((error) =>
      ipcLogger.logError("ipc handler failed", {
        channel,
        error,
      }),
    ),
    Effect.withSpan("topo.ipc.handle"),
    Effect.annotateLogs({ channel }),
  );
```

Adapt exact syntax to the actual `makeComponentLogger` signature from Task 2.

- [ ] **Step 3: Instrument high-value operations**

Add spans/logs around:

- `getAppState`
- `publishAppState`
- `installModelBundle`
- `registerNativeHotkey`
- `updateSettings`
- `showOverlayPreview`
- `commitOverlayPreviewPosition`
- `startTestDictation`
- `stopTestDictation`
- `copyTranscript`
- `reinsertTranscript`

Use annotations such as `modelId`, `runtime`, `language`, `recordingMode`, `overlayState`, `historyEnabled`, `insertionMode`, and counts. Do not log transcript text.

- [ ] **Step 4: Run focused tests**

Run: `pnpm --filter @topo/desktop test -- ipc-handlers`

Expected: PASS.

## Task 5: Model Install, Runtime, and Readiness Logs

**Files:**
- Modify: `apps/desktop/electron/model-install-job.ts`
- Modify: `apps/desktop/electron/runtime-install-job.ts`
- Modify: `apps/desktop/electron/model-catalog-service.ts`
- Modify: `apps/desktop/electron/model-readiness.ts`
- Modify: `apps/desktop/electron/whisper-cpp-runtime.ts`
- Modify: `apps/desktop/electron/whisperkit-bridge.ts`
- Modify related tests in `apps/desktop/electron/*.test.ts`

- [ ] **Step 1: Write tests for install milestone logging**

Extend install-job tests to run inside the observability test layer and assert trace records include:

- `topo.model.install`
- `modelId`
- `sourceType`
- status `download`, `verify`, `extract`, `installed`, `canceled`, or `failed`
- byte counts for downloaded files

- [ ] **Step 2: Instrument model install job**

Log:

- model install requested
- source resolved
- download started
- progress milestones at 0/25/50/75/100 percent, not every chunk
- checksum verification started/completed/failed
- archive extraction started/completed/failed
- final installed path as basename or app-relative path only
- cancellation

- [ ] **Step 3: Instrument runtime install job**

Use matching runtime annotations:

- `runtimeId`
- `engine`
- `platform`
- `architecture`
- `downloadedBytes`
- `totalBytes`
- `verificationStatus`

- [ ] **Step 4: Instrument catalog and readiness**

Log:

- remote manifest requested/succeeded/failed
- bundled fallback used
- catalog merge counts
- readiness probe start/end
- whisper-cpp runtime path resolution status
- whisperkit availability status and reason

- [ ] **Step 5: Run focused tests**

Run: `pnpm --filter @topo/desktop test -- model runtime whisper`

Expected: PASS.

## Task 6: ASR and Model Behavior Instrumentation

**Files:**
- Modify: `packages/asr/src/dictation-orchestrator.ts`
- Modify: `packages/asr/src/runtime-transcription-provider.ts`
- Modify: `packages/asr/src/whisper-cpp-provider.ts`
- Modify: `packages/asr/src/whisperkit-provider.ts`
- Modify: `packages/asr/src/local-ai-sdk-provider.ts`
- Modify: `packages/asr/src/post-processing-provider.ts`
- Modify: `packages/asr/src/apple-intelligence-ai-sdk-provider.ts`
- Modify: `packages/asr/src/*.test.ts`

- [ ] **Step 1: Write ASR trace tests**

Add tests that assert a dictation run emits spans/logs for:

- `topo.dictation.start`
- `topo.dictation.stop`
- `topo.transcription.run`
- `topo.post_processing.run`

Assertions should verify `modelId`, `runtime`, `language`, `recordingMode`, `audioDurationMs`, and `postProcessingMode`, and verify transcript text is not present in the log file.

- [ ] **Step 2: Instrument dictation orchestrator**

Add component logger `asr-dictation`. Log:

- session created
- recording stop requested
- captured audio metadata
- transcription start/end
- transcription warnings count
- post-processing mode selected
- post-processing recovered fallback
- cleanup success/failure as debug or warning

- [ ] **Step 3: Instrument runtime providers**

Add component loggers:

- `asr-runtime-router`
- `asr-whisper-cpp`
- `asr-whisperkit`
- `asr-local-ai-sdk`

Log model behavior:

- runtime route selected
- model id
- installed model path basename
- runtime binary path basename
- language
- provider duration
- warning count
- failure message/code
- child process exit code and stderr excerpt for `local-ai-sdk-provider`, capped and sanitized

- [ ] **Step 4: Instrument post-processing model behavior**

Add component logger `asr-post-processing`. Log:

- provider id
- model id
- prompt id
- target schema
- raw transcript length only
- generated text length only
- latency
- finish reason and token usage when the AI SDK returns it
- recoverable fallback with error name/message

For `appleIntelligence(...)`, log:

- `doGenerate` start/end
- model id
- prompt length only
- output length only
- unsupported `doStream` attempts as warning/error

- [ ] **Step 5: Run ASR tests**

Run: `pnpm --filter @topo/asr test`

Expected: PASS.

## Task 7: Diagnostics Manifest and Agent Handoff

**Files:**
- Modify: `apps/desktop/electron/observability.ts`
- Modify: `apps/desktop/electron/ipc-handlers.ts`
- Modify: `packages/contracts/src/ipc.ts`
- Modify: `packages/contracts/src/ipc.test.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `apps/desktop/electron/preload.ts`
- Modify: `apps/desktop/renderer/src/api/renderer-api.ts`

- [ ] **Step 1: Decide endpoint shape during implementation**

Default to an IPC method `diagnostics:export` returning:

```ts
interface DiagnosticsExportResult {
  readonly manifestPath: string;
  readonly logDirectory: string;
  readonly tracePath: string;
}
```

Do not build a renderer UI unless requested. The IPC endpoint is enough for agents and future UI.

- [ ] **Step 2: Add contract schema tests**

Extend `packages/contracts/src/ipc.test.ts` to decode the diagnostics result.

- [ ] **Step 3: Implement manifest writer**

Manifest must include:

- app version when available
- `runId`
- timestamp
- platform and arch
- packaged/dev
- log directory
- trace path
- active model id
- active runtime
- installed models with id/runtime/status only
- installed runtimes with id/engine/status only
- settings with API/provider secrets removed
- current app error message

- [ ] **Step 4: Wire IPC**

Add channel to `IpcChannels`, preload, renderer API, and `registerIpcHandlers`.

- [ ] **Step 5: Run contract and desktop tests**

Run:

```bash
pnpm --filter @topo/contracts test -- ipc.test.ts
pnpm --filter @topo/desktop test -- observability.test.ts ipc-handlers
```

Expected: PASS.

## Task 8: Full Verification

**Files:**
- No new files unless fixes are required.

- [ ] **Step 1: Run package tests touched by logging**

Run:

```bash
pnpm --filter @topo/shared test
pnpm --filter @topo/asr test
pnpm --filter @topo/desktop test
pnpm --filter @topo/contracts test
```

Expected: PASS.

- [ ] **Step 2: Run required project check**

Run:

```bash
pnpm run check
```

Expected: PASS.

- [ ] **Step 3: Manual smoke**

Run:

```bash
pnpm dev
```

Exercise:

- app startup
- model catalog load
- model readiness refresh
- model install cancel or dev smoke install
- test dictation start/stop
- post-processing mode switch
- diagnostics export IPC if implemented

Expected:

- `logs/topo.trace.ndjson` exists under Electron `userData`
- trace file has JSON lines with `runId`
- no transcript text, prompt body, API key, or clipboard/inserted text appears in the trace
- model behavior spans show model id, runtime, language, duration, warning counts, and failures

## Commit Plan

Use conventional commits and include the required trailer exactly once in every commit message:

```text
feat: add shared logging primitives

Co-authored-by: Codex <noreply@openai.com>
```

```text
feat: persist desktop observability traces

Co-authored-by: Codex <noreply@openai.com>
```

```text
feat: instrument dictation and model behavior

Co-authored-by: Codex <noreply@openai.com>
```

```text
feat: add diagnostics export

Co-authored-by: Codex <noreply@openai.com>
```

## Self-Review

- Spec coverage: The plan covers t3code-style rotating file logs, Effect trace persistence, IPC spans, install/runtime readiness logs, ASR/model behavior monitoring, and an agent-friendly diagnostics handoff.
- Placeholder scan: No task uses TBD/TODO/fill-in placeholders. Task 7 has one explicit implementation decision with a default endpoint shape, so work can proceed without asking unless the implementer finds a conflict.
- Type consistency: `RotatingFileSink`, `makeTraceSink`, `makeLocalFileTracer`, `makeComponentLogger`, `resolveLogDirectory`, `makeDesktopObservabilityLayer`, and diagnostics result names are consistent across tasks.
- Risk: Effect package imports may differ slightly between Topo’s `effect@3.21.2` and t3code’s current code. If an import differs, resolve it by matching Topo’s installed Effect exports and keep the public Topo APIs from this plan stable.
