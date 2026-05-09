import type { InstalledModelRecord } from "@molten-voice/shared";
import { describe, expect, it } from "vitest";
import { computeModelReadiness } from "./model-readiness";
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

describe("computeModelReadiness", () => {
  it("returns ready with a green lamp for a verified installed model and available runtime", () => {
    expect(
      computeModelReadiness({
        modelId: "whisper-cpp-small",
        runtime: "whisper-cpp",
        installedModel: installedModel(),
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
        runtimeResult: null,
      }),
    ).toMatchObject({
      status: "runtime-missing",
      lamp: "yellow",
      message: "parakeet runtime is not implemented yet.",
      runtimeBinaryPath: null,
    });
  });
});
