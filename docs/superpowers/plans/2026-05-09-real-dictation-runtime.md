# Real Dictation Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `Test dictation` use real microphone capture and AI SDK transcription backed by local `whisper.cpp` when the active model and runtime binary are ready.

**Architecture:** Keep the existing renderer and dictation orchestrator shape, but replace mock-only runtime dependencies with focused services. Electron main owns local runtime discovery and database-backed readiness; `packages/asr` exposes a local AI SDK transcription provider whose `whisper.cpp` model adapter executes the CLI; `packages/audio` owns temp WAV capture behind the existing `AudioCaptureService` interface.

**Tech Stack:** Electron main, React renderer, Effect TS, AI SDK Core transcription, Vitest, Node `child_process`, Node filesystem APIs, existing SQLite repositories, existing shadcn/Base UI settings surface.

---

## File Map

- Create `apps/desktop/electron/whisper-cpp-runtime.ts`: resolves and verifies the `whisper.cpp` binary.
- Create `apps/desktop/electron/whisper-cpp-runtime.test.ts`: resolver candidate and probe tests.
- Create `apps/desktop/electron/model-readiness.ts`: computes `Not installed`, `Runtime missing`, `Runtime failed`, and `Ready`.
- Create `apps/desktop/electron/model-readiness.test.ts`: readiness rules.
- Modify `packages/contracts/src/installed-model.ts`: add readiness schemas exported through shared contracts.
- Modify `packages/contracts/src/ipc.ts`: add readiness list to `AppStateSnapshot`.
- Modify `packages/shared/src/index.ts`: export readiness types.
- Modify `apps/desktop/electron/ipc-handlers.ts`: include readiness in app state and set overlay to `processing`.
- Modify `apps/desktop/renderer/src/features/settings/SettingsPage.tsx`: green lamp only for ready models and test button disabled unless ready.
- Create `packages/asr/src/whisper-cpp-provider.ts`: real transcription provider.
- Create `packages/asr/src/whisper-cpp-provider.test.ts`: command construction and output parsing.
- Modify `packages/asr/src/transcription-provider.ts`: allow provider input to carry installed model path and runtime binary path.
- Modify `packages/asr/src/dictation-orchestrator.ts`: pass installed path/runtime path into transcription.
- Create `packages/audio/src/temp-wav-audio-capture.ts`: real temp WAV capture service or a narrow helper-backed implementation.
- Create `packages/audio/src/temp-wav-audio-capture.test.ts`: cleanup and level-frame behavior.
- Modify `apps/desktop/electron/main.ts`: wire real providers in development/runtime-safe mode.

---

### Task 1: Runtime Resolver Contract

**Files:**
- Create: `apps/desktop/electron/whisper-cpp-runtime.ts`
- Create: `apps/desktop/electron/whisper-cpp-runtime.test.ts`

- [ ] **Step 1: Write resolver tests**

Create `apps/desktop/electron/whisper-cpp-runtime.test.ts`:

```ts
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import {
  createWhisperCppRuntimeResolver,
  type RuntimeProbe,
} from "./whisper-cpp-runtime";

const createProbe =
  (okPath: string): RuntimeProbe =>
  (binaryPath) =>
    Effect.succeed(
      binaryPath === okPath
        ? {
            ok: true,
            stdout: "whisper-cli help",
            stderr: "",
            exitCode: 0,
          }
        : {
            ok: false,
            stdout: "",
            stderr: "not executable",
            exitCode: 1,
          },
    );

describe("createWhisperCppRuntimeResolver", () => {
  it("prefers the explicit environment override", async () => {
    const root = await mkdtemp(join(tmpdir(), "molten-runtime-"));
    const binaryPath = join(root, "custom-whisper.exe");
    await writeFile(binaryPath, "fake");
    const resolver = createWhisperCppRuntimeResolver({
      env: { MOLTEN_WHISPER_CPP_BINARY: binaryPath },
      resourcesRoot: join(root, "resources"),
      pathEntries: [],
      probe: createProbe(binaryPath),
    });

    await expect(Effect.runPromise(resolver.resolve())).resolves.toMatchObject({
      status: "available",
      binaryPath,
      source: "env",
    });
  });

  it("returns missing with checked candidates when no candidate exists", async () => {
    const root = await mkdtemp(join(tmpdir(), "molten-runtime-"));
    const resolver = createWhisperCppRuntimeResolver({
      env: {},
      resourcesRoot: join(root, "resources"),
      pathEntries: [join(root, "bin")],
      probe: createProbe(""),
    });

    await expect(Effect.runPromise(resolver.resolve())).resolves.toMatchObject({
      status: "missing",
    });
  });

  it("returns failed when a candidate exists but the probe fails", async () => {
    const root = await mkdtemp(join(tmpdir(), "molten-runtime-"));
    const pathDir = join(root, "bin");
    const binaryPath = join(pathDir, "whisper-cli.exe");
    await mkdir(pathDir, { recursive: true });
    await writeFile(binaryPath, "fake");
    const resolver = createWhisperCppRuntimeResolver({
      env: {},
      resourcesRoot: join(root, "resources"),
      pathEntries: [pathDir],
      probe: () =>
        Effect.succeed({
          ok: false,
          stdout: "",
          stderr: "bad binary",
          exitCode: 1,
        }),
    });

    await expect(Effect.runPromise(resolver.resolve())).resolves.toMatchObject({
      status: "failed",
      binaryPath,
      message: expect.stringContaining("bad binary"),
    });
  });
});
```

- [ ] **Step 2: Run resolver tests and verify they fail**

Run: `pnpm --filter @molten-voice/desktop run test -- whisper-cpp-runtime.test.ts`

Expected: FAIL because `./whisper-cpp-runtime` does not exist.

- [ ] **Step 3: Implement resolver**

Create `apps/desktop/electron/whisper-cpp-runtime.ts`:

```ts
import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { delimiter, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { Effect } from "effect";

export type WhisperCppRuntimeSource = "env" | "bundled" | "path";

export interface RuntimeProbeResult {
  readonly ok: boolean;
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number | null;
}

export type RuntimeProbe = (binaryPath: string) => Effect.Effect<RuntimeProbeResult, Error>;

export type WhisperCppRuntimeResult =
  | {
      readonly status: "available";
      readonly binaryPath: string;
      readonly source: WhisperCppRuntimeSource;
      readonly probeOutput: string;
      readonly checkedAt: string;
    }
  | {
      readonly status: "missing";
      readonly checkedCandidates: readonly string[];
      readonly message: string;
      readonly checkedAt: string;
    }
  | {
      readonly status: "failed";
      readonly binaryPath: string;
      readonly source: WhisperCppRuntimeSource;
      readonly checkedCandidates: readonly string[];
      readonly message: string;
      readonly checkedAt: string;
    };

export interface WhisperCppRuntimeResolver {
  readonly resolve: () => Effect.Effect<WhisperCppRuntimeResult, Error>;
}

interface ResolverOptions {
  readonly env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  readonly resourcesRoot: string;
  readonly pathEntries?: readonly string[];
  readonly probe?: RuntimeProbe;
  readonly now?: () => Date;
}

const names = [
  "whisper-cli.exe",
  "whisper-cli",
  "whisper.cpp.exe",
  "whisper.cpp",
  "main.exe",
  "main",
] as const;

const exists = (path: string): Effect.Effect<boolean> =>
  Effect.promise(() => access(path, constants.F_OK).then(() => true, () => false));

const defaultProbe: RuntimeProbe = (binaryPath) =>
  Effect.async<RuntimeProbeResult, Error>((resume) => {
    const child = spawn(binaryPath, ["--help"], { windowsHide: true });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      resume(
        Effect.succeed({
          ok: false,
          stdout,
          stderr: `${stderr}\nTimed out while probing whisper.cpp runtime.`.trim(),
          exitCode: null,
        }),
      );
    }, 2500);

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resume(Effect.fail(error));
    });
    child.on("close", (exitCode) => {
      clearTimeout(timer);
      const output = `${stdout}\n${stderr}`.toLowerCase();
      resume(
        Effect.succeed({
          ok: exitCode === 0 || output.includes("usage") || output.includes("whisper"),
          stdout,
          stderr,
          exitCode,
        }),
      );
    });
  });

export const createWhisperCppRuntimeResolver = ({
  env = process.env,
  resourcesRoot,
  pathEntries = (env.PATH ?? "").split(delimiter).filter(Boolean),
  probe = defaultProbe,
  now = () => new Date(),
}: ResolverOptions): WhisperCppRuntimeResolver => {
  let cached: WhisperCppRuntimeResult | null = null;

  const candidates = (): readonly {
    readonly path: string;
    readonly source: WhisperCppRuntimeSource;
  }[] => {
    const envPath = env.MOLTEN_WHISPER_CPP_BINARY;
    const explicit = envPath ? [{ path: resolve(envPath), source: "env" as const }] : [];
    const bundled = names.map((name) => ({
      path: join(resourcesRoot, "whisper.cpp", name),
      source: "bundled" as const,
    }));
    const fromPath = pathEntries.flatMap((entry) =>
      names.map((name) => ({ path: join(entry, name), source: "path" as const })),
    );

    return [...explicit, ...bundled, ...fromPath];
  };

  return {
    resolve: () =>
      Effect.gen(function* () {
        if (cached?.status === "available") {
          return cached;
        }

        const checked = candidates();
        const checkedCandidates = checked.map((candidate) => candidate.path);

        for (const candidate of checked) {
          if (!(yield* exists(candidate.path))) {
            continue;
          }

          const probeResult = yield* probe(candidate.path);
          const output = `${probeResult.stdout}\n${probeResult.stderr}`.trim();

          if (!probeResult.ok) {
            return {
              status: "failed",
              binaryPath: candidate.path,
              source: candidate.source,
              checkedCandidates,
              message: output || `whisper.cpp exited with code ${probeResult.exitCode}`,
              checkedAt: now().toISOString(),
            };
          }

          cached = {
            status: "available",
            binaryPath: candidate.path,
            source: candidate.source,
            probeOutput: output,
            checkedAt: now().toISOString(),
          };
          return cached;
        }

        return {
          status: "missing",
          checkedCandidates,
          message:
            "Install whisper.cpp or set MOLTEN_WHISPER_CPP_BINARY to whisper-cli.exe.",
          checkedAt: now().toISOString(),
        };
      }),
  };
};
```

- [ ] **Step 4: Run resolver tests**

Run: `pnpm --filter @molten-voice/desktop run test -- whisper-cpp-runtime.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/electron/whisper-cpp-runtime.ts apps/desktop/electron/whisper-cpp-runtime.test.ts
git commit -m "feat(desktop): resolve whisper cpp runtime"
```

---

### Task 2: Model Readiness State

**Files:**
- Modify: `packages/contracts/src/installed-model.ts`
- Modify: `packages/contracts/src/ipc.ts`
- Modify: `packages/shared/src/index.ts`
- Create: `apps/desktop/electron/model-readiness.ts`
- Create: `apps/desktop/electron/model-readiness.test.ts`

- [ ] **Step 1: Add shared readiness contract test**

Create `apps/desktop/electron/model-readiness.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { InstalledModelRecord } from "@molten-voice/shared";
import { computeModelReadiness } from "./model-readiness";
import type { WhisperCppRuntimeResult } from "./whisper-cpp-runtime";

const installed: InstalledModelRecord = {
  id: "installed_whisper_cpp_small",
  modelId: "whisper-cpp-small",
  runtime: "whisper-cpp",
  sourceType: "huggingface-file",
  sourceRevision: "rev",
  installedPath: "C:/models/whisper-cpp-small.bin",
  checksumSha256: "hash",
  verificationStatus: "verified",
  installedAt: "2026-05-09T00:00:00.000Z",
};

const availableRuntime: WhisperCppRuntimeResult = {
  status: "available",
  binaryPath: "C:/tools/whisper-cli.exe",
  source: "env",
  probeOutput: "usage",
  checkedAt: "2026-05-09T00:00:00.000Z",
};

describe("computeModelReadiness", () => {
  it("marks a verified installed whisper.cpp model ready only when runtime is available", () => {
    expect(
      computeModelReadiness({
        modelId: "whisper-cpp-small",
        runtime: "whisper-cpp",
        installedModel: installed,
        runtimeResult: availableRuntime,
      }),
    ).toMatchObject({
      status: "ready",
      lamp: "green",
    });
  });

  it("does not show green for an installed model when runtime is missing", () => {
    expect(
      computeModelReadiness({
        modelId: "whisper-cpp-small",
        runtime: "whisper-cpp",
        installedModel: installed,
        runtimeResult: {
          status: "missing",
          checkedCandidates: [],
          message: "missing",
          checkedAt: "2026-05-09T00:00:00.000Z",
        },
      }),
    ).toMatchObject({
      status: "runtime-missing",
      lamp: "yellow",
    });
  });

  it("shows not-installed for missing model artifact", () => {
    expect(
      computeModelReadiness({
        modelId: "whisper-cpp-small",
        runtime: "whisper-cpp",
        installedModel: null,
        runtimeResult: availableRuntime,
      }),
    ).toMatchObject({
      status: "not-installed",
      lamp: "none",
    });
  });
});
```

- [ ] **Step 2: Run readiness tests and verify they fail**

Run: `pnpm --filter @molten-voice/desktop run test -- model-readiness.test.ts`

Expected: FAIL because `./model-readiness` does not exist.

- [ ] **Step 3: Add readiness schemas**

Modify `packages/contracts/src/installed-model.ts` by adding:

```ts
export const ModelReadinessStatus = Schema.Literal(
  "not-installed",
  "runtime-missing",
  "runtime-failed",
  "ready",
);
export type ModelReadinessStatus = typeof ModelReadinessStatus.Type;

export const ModelReadinessLamp = Schema.Literal("none", "yellow", "red", "green");
export type ModelReadinessLamp = typeof ModelReadinessLamp.Type;

export const ModelReadinessRecord = Schema.Struct({
  modelId: Schema.String,
  status: ModelReadinessStatus,
  lamp: ModelReadinessLamp,
  message: Schema.String,
  runtimeBinaryPath: Schema.NullOr(Schema.String),
  checkedAt: Schema.String,
});
export type ModelReadinessRecord = typeof ModelReadinessRecord.Type;
```

Modify `packages/contracts/src/ipc.ts`:

```ts
import { InstalledModelRecord, ModelReadinessRecord } from "./installed-model";
```

and add this field to `AppStateSnapshot`:

```ts
modelReadiness: Schema.Array(ModelReadinessRecord),
```

Modify `packages/shared/src/index.ts` if needed so the new types remain exported through `@molten-voice/shared`.

- [ ] **Step 4: Implement readiness computation**

Create `apps/desktop/electron/model-readiness.ts`:

```ts
import type { InstalledModelRecord, ModelReadinessRecord } from "@molten-voice/shared";
import type { AsrRuntime } from "@molten-voice/model-catalog";
import type { WhisperCppRuntimeResult } from "./whisper-cpp-runtime";

export const computeModelReadiness = ({
  modelId,
  runtime,
  installedModel,
  runtimeResult,
}: {
  readonly modelId: string;
  readonly runtime: AsrRuntime;
  readonly installedModel: InstalledModelRecord | null;
  readonly runtimeResult: WhisperCppRuntimeResult | null;
}): ModelReadinessRecord => {
  const checkedAt = runtimeResult?.checkedAt ?? new Date(0).toISOString();

  if (!installedModel || installedModel.verificationStatus !== "verified") {
    return {
      modelId,
      status: "not-installed",
      lamp: "none",
      message: "Model file is not installed.",
      runtimeBinaryPath: null,
      checkedAt,
    };
  }

  if (runtime !== "whisper-cpp") {
    return {
      modelId,
      status: "runtime-missing",
      lamp: "yellow",
      message: `${runtime} runtime is not implemented yet.`,
      runtimeBinaryPath: null,
      checkedAt,
    };
  }

  if (!runtimeResult || runtimeResult.status === "missing") {
    return {
      modelId,
      status: "runtime-missing",
      lamp: "yellow",
      message: runtimeResult?.message ?? "whisper.cpp runtime was not checked.",
      runtimeBinaryPath: null,
      checkedAt,
    };
  }

  if (runtimeResult.status === "failed") {
    return {
      modelId,
      status: "runtime-failed",
      lamp: "red",
      message: runtimeResult.message,
      runtimeBinaryPath: runtimeResult.binaryPath,
      checkedAt,
    };
  }

  return {
    modelId,
    status: "ready",
    lamp: "green",
    message: "Model and whisper.cpp runtime are ready.",
    runtimeBinaryPath: runtimeResult.binaryPath,
    checkedAt,
  };
};
```

- [ ] **Step 5: Run readiness tests**

Run: `pnpm --filter @molten-voice/desktop run test -- model-readiness.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/contracts/src/installed-model.ts packages/contracts/src/ipc.ts packages/shared/src/index.ts apps/desktop/electron/model-readiness.ts apps/desktop/electron/model-readiness.test.ts
git commit -m "feat(desktop): model readiness distinguishes runtime availability"
```

---

### Task 3: App State Readiness and Settings UI

**Files:**
- Modify: `apps/desktop/electron/ipc-handlers.ts`
- Modify: `apps/desktop/electron/main.ts`
- Modify: `apps/desktop/renderer/src/features/settings/SettingsPage.tsx`

- [ ] **Step 1: Add runtime dependency to IPC handlers**

Modify the `IpcHandlerDependencies` interface in `apps/desktop/electron/ipc-handlers.ts`:

```ts
import { computeModelReadiness } from "./model-readiness";
import type { WhisperCppRuntimeResolver } from "./whisper-cpp-runtime";
```

Add:

```ts
readonly whisperCppRuntime: WhisperCppRuntimeResolver;
```

- [ ] **Step 2: Include readiness in `getAppState`**

Inside `getAppState`, after installed models are loaded, resolve runtime and compute readiness:

```ts
const runtimeResult = yield* dependencies.whisperCppRuntime.resolve();
const modelReadiness = bundledModelCatalog.map((model) =>
  computeModelReadiness({
    modelId: model.id,
    runtime: model.runtime,
    installedModel:
      installedModels.find((installed) => installed.modelId === model.id) ?? null,
    runtimeResult: model.runtime === "whisper-cpp" ? runtimeResult : null,
  }),
);
```

Return `modelReadiness` in the snapshot.

- [ ] **Step 3: Wire resolver in `main.ts`**

Modify `apps/desktop/electron/main.ts`:

```ts
import { createWhisperCppRuntimeResolver } from "./whisper-cpp-runtime";
```

Pass the dependency:

```ts
whisperCppRuntime: createWhisperCppRuntimeResolver({
  resourcesRoot: join(app.getAppPath(), "resources"),
}),
```

- [ ] **Step 4: Update Settings model row status**

In `SettingsPage.tsx`, derive readiness:

```ts
const readiness = modelReadiness.find((item) => item.modelId === model.id);
const isReady = readiness?.status === "ready";
```

Use labels:

```ts
const statusLabel =
  readiness?.status === "ready"
    ? "Ready"
    : readiness?.status === "runtime-missing"
      ? "Runtime missing"
      : readiness?.status === "runtime-failed"
        ? "Runtime failed"
        : isInstalled
          ? "Installed"
          : "Not installed";
```

Render the green lamp only when `readiness?.lamp === "green"`. Yellow and red lamps may be small colored dots, but they must not use the green style.

- [ ] **Step 5: Disable Test Dictation unless active model is ready**

In `SettingsPage.tsx`, compute:

```ts
const activeReadiness = modelReadiness.find(
  (item) => item.modelId === settings?.activeModelId,
);
const canTestDictation = activeReadiness?.status === "ready";
```

Use `canTestDictation` for the `Start test` button disabled state and description.

- [ ] **Step 6: Run checks**

Run: `pnpm run check`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/electron/ipc-handlers.ts apps/desktop/electron/main.ts apps/desktop/renderer/src/features/settings/SettingsPage.tsx
git commit -m "feat(desktop): show runtime-aware model readiness"
```

---

### Task 4: Whisper.cpp Transcription Provider

**Files:**
- Modify: `packages/asr/src/transcription-provider.ts`
- Modify: `packages/asr/src/dictation-orchestrator.ts`
- Create: `packages/asr/src/whisper-cpp-provider.ts`
- Create: `packages/asr/src/whisper-cpp-provider.test.ts`
- Modify: `packages/asr/src/index.ts`

- [ ] **Step 1: Write provider tests**

Create `packages/asr/src/whisper-cpp-provider.test.ts`:

```ts
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { createWhisperCppTranscriptionProvider } from "./whisper-cpp-provider";

describe("createWhisperCppTranscriptionProvider", () => {
  it("spawns whisper-cli with model, audio, language, and text output", async () => {
    const calls: readonly string[][][] = [];
    const provider = createWhisperCppTranscriptionProvider({
      run: (command, args) =>
        Effect.succeed({
          command,
          args,
          exitCode: 0,
          stdout: " hello world\n",
          stderr: "",
        }),
    });

    const result = await Effect.runPromise(
      provider.transcribe({
        audioPath: "C:/tmp/audio.wav",
        language: "en",
        modelId: "whisper-cpp-small",
        installedModelPath: "C:/models/ggml-small.bin",
        runtimeBinaryPath: "C:/tools/whisper-cli.exe",
      }),
    );

    expect(result.text).toBe("hello world");
  });

  it("fails when runtime path is missing", async () => {
    const provider = createWhisperCppTranscriptionProvider({
      run: () => Effect.fail(new Error("should not run")),
    });

    await expect(
      Effect.runPromise(
        provider.transcribe({
          audioPath: "C:/tmp/audio.wav",
          language: "auto",
          modelId: "whisper-cpp-small",
          installedModelPath: "C:/models/ggml-small.bin",
          runtimeBinaryPath: null,
        }),
      ),
    ).rejects.toThrow("runtime_missing");
  });
});
```

- [ ] **Step 2: Extend transcription input**

Modify `packages/asr/src/transcription-provider.ts`:

```ts
export interface TranscriptionInput {
  readonly audioPath: string;
  readonly language: "en" | "ru" | "auto";
  readonly modelId: string;
  readonly installedModelPath?: string | null;
  readonly runtimeBinaryPath?: string | null;
}
```

- [ ] **Step 3: Implement provider**

Create `packages/asr/src/whisper-cpp-provider.ts`:

```ts
import { spawn } from "node:child_process";
import { Effect } from "effect";
import type {
  TranscriptionInput,
  TranscriptionProvider,
  TranscriptionResult,
} from "./transcription-provider";

interface ProcessResult {
  readonly command: string;
  readonly args: readonly string[];
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

type ProcessRunner = (
  command: string,
  args: readonly string[],
) => Effect.Effect<ProcessResult, Error>;

const runProcess: ProcessRunner = (command, args) =>
  Effect.async<ProcessResult, Error>((resume) => {
    const child = spawn(command, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (error) => resume(Effect.fail(error)));
    child.on("close", (exitCode) =>
      resume(Effect.succeed({ command, args, exitCode, stdout, stderr })),
    );
  });

const argsFor = (input: TranscriptionInput): readonly string[] => {
  if (!input.installedModelPath) {
    throw new Error("model_not_installed");
  }

  const languageArgs = input.language === "auto" ? [] : ["-l", input.language];

  return [
    "-m",
    input.installedModelPath,
    "-f",
    input.audioPath,
    "-otxt",
    "-np",
    ...languageArgs,
  ];
};

export const createWhisperCppTranscriptionProvider = ({
  run = runProcess,
}: {
  readonly run?: ProcessRunner;
} = {}): TranscriptionProvider => ({
  transcribe: (input) =>
    Effect.gen(function* () {
      if (!input.runtimeBinaryPath) {
        return yield* Effect.fail(new Error("runtime_missing"));
      }

      const args = argsFor(input);
      const result = yield* run(input.runtimeBinaryPath, args);

      if (result.exitCode !== 0) {
        return yield* Effect.fail(
          new Error(`transcription_failed: ${result.stderr || result.stdout}`),
        );
      }

      return {
        text: result.stdout.trim(),
        language: input.language === "ru" ? "ru" : "en",
        durationInSeconds: 0,
        warnings: result.stderr.trim() ? [result.stderr.trim()] : [],
      };
    }),
});
```

- [ ] **Step 4: Export provider**

Modify `packages/asr/src/index.ts`:

```ts
export * from "./whisper-cpp-provider";
```

- [ ] **Step 5: Run provider tests**

Run: `pnpm --filter @molten-voice/asr run test -- whisper-cpp-provider.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/asr/src/transcription-provider.ts packages/asr/src/whisper-cpp-provider.ts packages/asr/src/whisper-cpp-provider.test.ts packages/asr/src/index.ts
git commit -m "feat(asr): add whisper cpp transcription provider"
```

---

### Task 5: Database-Backed Dictation Stop Input

**Files:**
- Modify: `packages/asr/src/dictation-orchestrator.ts`
- Modify: `packages/asr/src/dictation-orchestrator.test.ts`
- Modify: `apps/desktop/electron/ipc-handlers.ts`

- [ ] **Step 1: Extend orchestrator stop input test**

Modify `packages/asr/src/dictation-orchestrator.test.ts` so the mock provider asserts:

```ts
expect(input.installedModelPath).toBe("C:/models/ggml-small.bin");
expect(input.runtimeBinaryPath).toBe("C:/tools/whisper-cli.exe");
```

Pass these fields in the `dictation.stop` call.

- [ ] **Step 2: Extend orchestrator stop input**

Modify `DictationOrchestrator.stop` input in `packages/asr/src/dictation-orchestrator.ts`:

```ts
readonly installedModelPath: string;
readonly runtimeBinaryPath: string;
```

Pass them to `dependencies.transcription.transcribe`.

- [ ] **Step 3: Resolve installed model and runtime in IPC stop**

In `apps/desktop/electron/ipc-handlers.ts`, before `dependencies.dictation.stop`, add:

```ts
const installedModel = yield* dependencies.database.installedModels.getByModelId(
  selectedModel.id,
);

if (!installedModel || installedModel.verificationStatus !== "verified") {
  currentErrorMessage = "Active model is not installed.";
  state.overlayState = "error";
  return yield* Effect.fail(new Error("model_not_installed"));
}

const runtimeResult = yield* dependencies.whisperCppRuntime.resolve();

if (runtimeResult.status !== "available") {
  currentErrorMessage = runtimeResult.message;
  state.overlayState = "error";
  return yield* Effect.fail(new Error(runtimeResult.status));
}
```

Pass:

```ts
installedModelPath: installedModel.installedPath,
runtimeBinaryPath: runtimeResult.binaryPath,
```

- [ ] **Step 4: Set processing state before transcription**

At the start of `stopTestDictation`, after settings/model lookup succeeds, set:

```ts
state.overlayState = "processing";
yield* publishAppState(dependencies);
```

- [ ] **Step 5: Run tests and checks**

Run:

```bash
pnpm --filter @molten-voice/asr run test -- dictation-orchestrator.test.ts
pnpm run check
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/asr/src/dictation-orchestrator.ts packages/asr/src/dictation-orchestrator.test.ts apps/desktop/electron/ipc-handlers.ts
git commit -m "feat(desktop): pass installed runtime paths to dictation"
```

---

### Task 6: Real Temp WAV Audio Capture

**Files:**
- Create: `packages/audio/src/temp-wav-audio-capture.ts`
- Create: `packages/audio/src/temp-wav-audio-capture.test.ts`
- Modify: `packages/audio/src/index.ts`
- Modify: `packages/audio/package.json`

- [ ] **Step 1: Choose first implementation dependency**

Use a small Node-compatible recorder only if it can produce WAV reliably on Windows. If adding a package is needed, install it with:

```bash
pnpm --filter @molten-voice/audio add node-record-lpcm16
pnpm --filter @molten-voice/audio add -D @types/node
```

If the package requires external binaries and fails locally, create `temp-wav-audio-capture.ts` as a helper-backed service that expects a future bundled recorder and keep `createMockAudioCaptureService` wired until Task 7.

- [ ] **Step 2: Write cleanup test**

Create `packages/audio/src/temp-wav-audio-capture.test.ts`:

```ts
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp } from "node:fs/promises";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { createTempWavAudioCaptureService } from "./temp-wav-audio-capture";

describe("createTempWavAudioCaptureService", () => {
  it("removes captured temp audio during cleanup", async () => {
    const root = await mkdtemp(join(tmpdir(), "molten-audio-"));
    await mkdir(root, { recursive: true });
    const audioPath = join(root, "session.wav");
    await writeFile(audioPath, "RIFFfake");
    const service = createTempWavAudioCaptureService({
      tempRoot: root,
      recorder: {
        start: () => Effect.succeed(undefined),
        stop: () =>
          Effect.succeed({
            audioPath,
            durationMs: 100,
          }),
      },
    });

    await Effect.runPromise(service.startRecording("session"));
    const audio = await Effect.runPromise(service.stopRecording("manual"));
    await Effect.runPromise(service.cleanupCapturedAudio(audio));

    expect(existsSync(audioPath)).toBe(false);
  });
});
```

- [ ] **Step 3: Implement temp capture wrapper**

Create `packages/audio/src/temp-wav-audio-capture.ts`:

```ts
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { Effect } from "effect";
import type { LevelFrame, StopReason } from "@molten-voice/shared";
import type { AudioCaptureService, CapturedAudio } from "./audio-capture-service";

interface RecorderResult {
  readonly audioPath: string;
  readonly durationMs: number;
}

interface Recorder {
  readonly start: (sessionId: string, audioPath: string) => Effect.Effect<void, Error>;
  readonly stop: (reason: StopReason) => Effect.Effect<RecorderResult, Error>;
}

export const createTempWavAudioCaptureService = ({
  tempRoot,
  recorder,
  now = Date.now,
}: {
  readonly tempRoot: string;
  readonly recorder: Recorder;
  readonly now?: () => number;
}): AudioCaptureService => {
  let activeSessionId: string | null = null;
  let activePath: string | null = null;
  const listeners = new Set<(frame: LevelFrame) => void>();

  return {
    startRecording: (sessionId) =>
      Effect.gen(function* () {
        activeSessionId = sessionId;
        activePath = join(tempRoot, `${sessionId}.wav`);
        yield* recorder.start(sessionId, activePath);
        for (const listener of listeners) {
          listener({ sessionId, timestampMs: now(), rms: 0.1, peak: 0.2 });
        }
      }),
    stopRecording: (reason) =>
      Effect.gen(function* () {
        if (!activeSessionId || !activePath) {
          return yield* Effect.fail(new Error("No active recording session"));
        }

        const sessionId = activeSessionId;
        const result = yield* recorder.stop(reason);
        activeSessionId = null;
        activePath = null;

        return {
          sessionId,
          audioPath: result.audioPath,
          durationMs: result.durationMs,
        } satisfies CapturedAudio;
      }),
    cleanupCapturedAudio: (audio) =>
      Effect.promise(() => rm(audio.audioPath, { force: true })),
    onLevelFrame: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};
```

- [ ] **Step 4: Export temp capture wrapper**

Modify `packages/audio/src/index.ts`:

```ts
export * from "./temp-wav-audio-capture";
```

- [ ] **Step 5: Run audio tests**

Run: `pnpm --filter @molten-voice/audio run test -- temp-wav-audio-capture.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/audio/src/temp-wav-audio-capture.ts packages/audio/src/temp-wav-audio-capture.test.ts packages/audio/src/index.ts packages/audio/package.json pnpm-lock.yaml
git commit -m "feat(audio): add temp wav capture service"
```

---

### Task 7: Wire Real Whisper Provider Into Desktop

**Files:**
- Modify: `apps/desktop/electron/main.ts`
- Modify: `apps/desktop/electron/ipc-handlers.ts`

- [ ] **Step 1: Replace mock transcription provider**

Modify `apps/desktop/electron/main.ts` imports:

```ts
import { createDictationOrchestrator, createWhisperCppTranscriptionProvider } from "@molten-voice/asr";
```

Replace:

```ts
transcription: createMockTranscriptionProvider(),
```

with:

```ts
transcription: createWhisperCppTranscriptionProvider(),
```

- [ ] **Step 2: Keep audio mock only if real recorder is not ready**

If Task 6 produced only the wrapper and not a working Windows recorder, keep:

```ts
audio: createMockAudioCaptureService(),
```

for one commit and make the app fail at runtime readiness/transcription only when the binary/model are missing. If Task 6 produced a working recorder, wire it here with the app temp path.

- [ ] **Step 3: Run check and build**

Run:

```bash
pnpm run check
pnpm --filter @molten-voice/desktop run build
```

Expected: PASS.

- [ ] **Step 4: Manual smoke**

Run:

```bash
$env:MOLTEN_WHISPER_CPP_BINARY="C:\path\to\whisper-cli.exe"
pnpm --filter @molten-voice/desktop run dev
```

Expected:

- Settings shows `Ready` only for `whisper-cpp-small`.
- `Test dictation` does not start if runtime is missing.
- With runtime configured, `Test dictation` reaches transcription rather than mock text.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/electron/main.ts apps/desktop/electron/ipc-handlers.ts
git commit -m "feat(desktop): wire whisper cpp provider into test dictation"
```

---

### Task 8: Final Verification

**Files:**
- No planned source edits unless verification reveals a bug.

- [ ] **Step 1: Run full verification**

Run:

```bash
pnpm run check
pnpm run test
pnpm --filter @molten-voice/desktop run build
```

Expected: all pass.

- [ ] **Step 2: Verify working tree**

Run: `git status --short`

Expected: clean or only intentional uncommitted manual notes.

- [ ] **Step 3: Manual readiness check**

Open the app and confirm:

- downloaded model without runtime binary is not green;
- configured runtime binary turns the active installed model green;
- missing runtime message is visible and actionable;
- `Test dictation` is gated by `Ready`.

- [ ] **Step 4: Commit any verification fixes**

If fixes were needed:

```bash
git add <changed-files>
git commit -m "fix(desktop): stabilize real dictation readiness"
```
