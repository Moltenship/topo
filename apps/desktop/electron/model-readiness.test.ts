import type { InstalledModelRecord, InstalledRuntimeRecord } from "@topo/shared";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import {
  computeModelReadiness,
  computeModelReadinessForCatalog,
  createWhisperCppRuntimeReadinessCache,
} from "./model-readiness";
import type { WhisperCppRuntimeResult } from "./whisper-cpp-runtime";

const installedModel = (
  verificationStatus: InstalledModelRecord["verificationStatus"] = "verified",
): InstalledModelRecord => ({
  id: "installed-whisper-cpp-small",
  modelId: "whisper-cpp-small",
  runtime: "whisper-cpp",
  sourceType: "local-file",
  sourceRevision: "dev",
  installedPath: "C:/models/whisper-cpp-small/ggml-small.bin",
  checksumSha256: "abc123",
  verificationStatus,
  installedAt: "2026-05-09T10:00:00.000Z",
});

const availableRuntime: WhisperCppRuntimeResult = {
  status: "available",
  binaryPath: "C:/tools/whisper-cli.exe",
  source: "path",
  probeOutput: "usage: whisper-cli",
  checkedAt: "2026-05-09T11:00:00.000Z",
};

const installedRuntime = (
  verificationStatus: InstalledRuntimeRecord["verificationStatus"] = "verified",
): InstalledRuntimeRecord => ({
  id: "installed-whisper-cpp-windows-x64",
  runtimeId: "whisper-cpp-windows-x64",
  engine: "whisper-cpp",
  installedPath: "C:/runtimes/whisper-cpp-windows-x64",
  binaryPath: "C:/runtimes/whisper-cpp-windows-x64/whisper-cli.exe",
  checksumSha256: "runtime-sha",
  verificationStatus,
  installedAt: "2026-05-09T10:30:00.000Z",
  lastProbedAt: "2026-05-09T11:00:00.000Z",
  lastProbeMessage: "usage: whisper-cli",
});

describe("computeModelReadiness", () => {
  it("returns ready with a green lamp for a verified installed model and available runtime", () => {
    expect(
      computeModelReadiness({
        modelId: "whisper-cpp-small",
        runtime: "whisper-cpp",
        installedModel: installedModel(),
        installedRuntime: installedRuntime(),
        runtimeResult: availableRuntime,
      }),
    ).toEqual({
      modelId: "whisper-cpp-small",
      status: "ready",
      lamp: "green",
      message: "Model and whisper.cpp runtime are ready.",
      runtimeBinaryPath: "C:/tools/whisper-cli.exe",
      checkedAt: "2026-05-09T11:00:00.000Z",
    });
  });

  it("returns runtime-missing with a yellow lamp when the runtime is missing", () => {
    const runtimeResult: WhisperCppRuntimeResult = {
      status: "missing",
      checkedCandidates: ["C:/tools/whisper-cli.exe"],
      message: "whisper.cpp runtime was not found.",
      checkedAt: "2026-05-09T11:00:00.000Z",
    };

    const result = computeModelReadiness({
      modelId: "whisper-cpp-small",
      runtime: "whisper-cpp",
      installedModel: installedModel(),
      installedRuntime: installedRuntime(),
      runtimeResult,
    });

    expect(result).toMatchObject({
      status: "runtime-missing",
      lamp: "yellow",
      message: "whisper.cpp runtime was not found.",
      runtimeBinaryPath: null,
    });
    expect(result.lamp).not.toBe("green");
  });

  it("returns not-installed with no lamp when the model is missing even if runtime is available", () => {
    expect(
      computeModelReadiness({
        modelId: "whisper-cpp-small",
        runtime: "whisper-cpp",
        installedModel: null,
        installedRuntime: installedRuntime(),
        runtimeResult: availableRuntime,
      }),
    ).toMatchObject({
      status: "not-installed",
      lamp: "none",
      message: "Model file is not installed.",
      runtimeBinaryPath: null,
    });
  });

  it("returns not-installed with no lamp when the installed model is corrupt", () => {
    expect(
      computeModelReadiness({
        modelId: "whisper-cpp-small",
        runtime: "whisper-cpp",
        installedModel: installedModel("corrupt"),
        installedRuntime: installedRuntime(),
        runtimeResult: availableRuntime,
      }),
    ).toMatchObject({
      status: "not-installed",
      lamp: "none",
      message: "Model file is not installed.",
      runtimeBinaryPath: null,
    });
  });

  it("returns runtime-missing with a yellow lamp for an installed non-whisper runtime model", () => {
    expect(
      computeModelReadiness({
        modelId: "parakeet-small",
        runtime: "parakeet",
        installedModel: installedModel(),
        installedRuntime: null,
        runtimeResult: null,
      }),
    ).toMatchObject({
      status: "runtime-missing",
      lamp: "yellow",
      message: "parakeet runtime is not implemented yet.",
      runtimeBinaryPath: null,
    });
  });

  it("returns ready for a verified installed WhisperKit model without a runtime record", () => {
    expect(
      computeModelReadiness({
        modelId: "whisperkit-small",
        runtime: "whisperkit",
        installedModel: {
          ...installedModel(),
          modelId: "whisperkit-small",
          runtime: "whisperkit",
          installedPath: "/models/whisperkit-small",
        },
        installedRuntime: null,
        runtimeResult: null,
      }),
    ).toMatchObject({
      status: "ready",
      lamp: "green",
      message: "Model and WhisperKit runtime are ready.",
      runtimeBinaryPath: null,
    });
  });

  it("returns not-installed for a missing WhisperKit model", () => {
    expect(
      computeModelReadiness({
        modelId: "whisperkit-small",
        runtime: "whisperkit",
        installedModel: null,
        installedRuntime: null,
        runtimeResult: null,
      }),
    ).toMatchObject({
      status: "not-installed",
      lamp: "none",
      runtimeBinaryPath: null,
    });
  });
});

describe("createWhisperCppRuntimeReadinessCache", () => {
  it("does not call the resolver repeatedly within the TTL for missing runtime results", async () => {
    let nowMs = 1_000;
    let resolveCount = 0;
    const missingRuntime: WhisperCppRuntimeResult = {
      status: "missing",
      checkedCandidates: ["C:/tools/whisper-cli.exe"],
      message: "whisper.cpp runtime was not found.",
      checkedAt: "2026-05-09T11:00:00.000Z",
    };
    const cache = createWhisperCppRuntimeReadinessCache({
      ttlMs: 30_000,
      now: () => nowMs,
    });
    const resolver = {
      resolve: () =>
        Effect.sync(() => {
          resolveCount += 1;

          return missingRuntime;
        }),
    };

    await Effect.runPromise(cache.resolve(resolver));
    await Effect.runPromise(cache.resolve(resolver));
    nowMs += 30_001;
    await Effect.runPromise(cache.resolve(resolver));

    expect(resolveCount).toBe(2);
  });
});

describe("computeModelReadinessForCatalog", () => {
  it("includes models from the effective catalog in readiness", () => {
    const records = computeModelReadinessForCatalog({
      catalog: [
        {
          id: "dev-smoke-model",
          displayName: "Dev Smoke Model",
          runtime: "whisper-cpp",
          runtimeRequirement: {
            engine: "whisper-cpp",
            supportedRuntimeIds: ["whisper-cpp-windows-x64"],
          },
          platforms: ["windows"],
          architectures: ["x64"],
          languages: ["en"],
          source: {
            type: "local-file",
            relativePath: "dev-models/dev-smoke-model.bin",
          },
          installStrategy: {
            type: "single-file",
          },
          downloadUrl: "local-file://dev-models/dev-smoke-model.bin",
          checksumSha256: "abc123",
          downloadSizeBytes: 512000,
          diskSizeBytes: 512000,
          estimatedMemoryBytes: 16 * 1024 * 1024,
          qualityLabel: "fast",
          speedLabel: "fastest",
          accuracyScore: 10,
          speedScore: 100,
          recommendedReason: "Test fixture.",
          badges: ["dev"],
          experimental: true,
          devOnly: true,
        },
      ],
      installedRuntimes: [installedRuntime()],
      installedModels: [
        {
          ...installedModel(),
          id: "installed-dev-smoke-model",
          modelId: "dev-smoke-model",
        },
      ],
      whisperCppRuntimeResult: availableRuntime,
    });

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      modelId: "dev-smoke-model",
      status: "ready",
      lamp: "green",
    });
  });

  it("marks installed whisper.cpp models yellow when the installed runtime is absent", () => {
    const records = computeModelReadinessForCatalog({
      catalog: [
        {
          id: "dev-smoke-model",
          displayName: "Dev Smoke Model",
          runtime: "whisper-cpp",
          runtimeRequirement: {
            engine: "whisper-cpp",
            supportedRuntimeIds: ["whisper-cpp-windows-x64"],
          },
          platforms: ["windows"],
          architectures: ["x64"],
          languages: ["en"],
          source: {
            type: "local-file",
            relativePath: "dev-models/dev-smoke-model.bin",
          },
          installStrategy: {
            type: "single-file",
          },
          downloadUrl: "local-file://dev-models/dev-smoke-model.bin",
          checksumSha256: "abc123",
          downloadSizeBytes: 512000,
          diskSizeBytes: 512000,
          estimatedMemoryBytes: 16 * 1024 * 1024,
          qualityLabel: "fast",
          speedLabel: "fastest",
          accuracyScore: 10,
          speedScore: 100,
          recommendedReason: "Test fixture.",
          badges: ["dev"],
          experimental: true,
          devOnly: true,
        },
      ],
      installedModels: [
        {
          ...installedModel(),
          id: "installed-dev-smoke-model",
          modelId: "dev-smoke-model",
        },
      ],
      installedRuntimes: [],
      whisperCppRuntimeResult: null,
    });

    expect(records[0]).toMatchObject({
      status: "runtime-missing",
      lamp: "yellow",
      runtimeBinaryPath: null,
    });
  });

  it("marks corrupt installed runtimes red", () => {
    const records = computeModelReadinessForCatalog({
      catalog: [
        {
          id: "dev-smoke-model",
          displayName: "Dev Smoke Model",
          runtime: "whisper-cpp",
          runtimeRequirement: {
            engine: "whisper-cpp",
            supportedRuntimeIds: ["whisper-cpp-windows-x64"],
          },
          platforms: ["windows"],
          architectures: ["x64"],
          languages: ["en"],
          source: {
            type: "local-file",
            relativePath: "dev-models/dev-smoke-model.bin",
          },
          installStrategy: {
            type: "single-file",
          },
          downloadUrl: "local-file://dev-models/dev-smoke-model.bin",
          checksumSha256: "abc123",
          downloadSizeBytes: 512000,
          diskSizeBytes: 512000,
          estimatedMemoryBytes: 16 * 1024 * 1024,
          qualityLabel: "fast",
          speedLabel: "fastest",
          accuracyScore: 10,
          speedScore: 100,
          recommendedReason: "Test fixture.",
          badges: ["dev"],
          experimental: true,
          devOnly: true,
        },
      ],
      installedModels: [
        {
          ...installedModel(),
          id: "installed-dev-smoke-model",
          modelId: "dev-smoke-model",
        },
      ],
      installedRuntimes: [installedRuntime("corrupt")],
      whisperCppRuntimeResult: availableRuntime,
    });

    expect(records[0]).toMatchObject({
      status: "runtime-failed",
      lamp: "red",
      runtimeBinaryPath: "C:/runtimes/whisper-cpp-windows-x64/whisper-cli.exe",
    });
  });
});
