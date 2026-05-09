import type { AsrRuntime } from "@molten-voice/model-catalog";
import type { InstalledModelRecord, ModelReadinessRecord } from "@molten-voice/shared";
import type { WhisperCppRuntimeResult } from "./whisper-cpp-runtime";

export interface ComputeModelReadinessInput {
  readonly modelId: string;
  readonly runtime: AsrRuntime;
  readonly installedModel: InstalledModelRecord | null;
  readonly runtimeResult: WhisperCppRuntimeResult | null;
}

const nowIso = (): string => new Date().toISOString();

const checkedAtFor = (runtimeResult: WhisperCppRuntimeResult | null): string =>
  runtimeResult?.checkedAt ?? nowIso();

export const computeModelReadiness = ({
  modelId,
  runtime,
  installedModel,
  runtimeResult,
}: ComputeModelReadinessInput): ModelReadinessRecord => {
  if (!installedModel || installedModel.verificationStatus !== "verified") {
    return {
      modelId,
      status: "not-installed",
      lamp: "none",
      message: "Model file is not installed.",
      runtimeBinaryPath: null,
      checkedAt: checkedAtFor(runtimeResult),
    };
  }

  if (runtime !== "whisper-cpp") {
    return {
      modelId,
      status: "runtime-missing",
      lamp: "yellow",
      message: `${runtime} runtime is not implemented yet.`,
      runtimeBinaryPath: null,
      checkedAt: checkedAtFor(runtimeResult),
    };
  }

  if (!runtimeResult || runtimeResult.status === "missing") {
    return {
      modelId,
      status: "runtime-missing",
      lamp: "yellow",
      message:
        runtimeResult?.message ??
        "whisper.cpp runtime was not found. Set MOLTEN_WHISPER_CPP_BINARY or install whisper-cli on PATH.",
      runtimeBinaryPath: null,
      checkedAt: checkedAtFor(runtimeResult),
    };
  }

  if (runtimeResult.status === "failed") {
    return {
      modelId,
      status: "runtime-failed",
      lamp: "red",
      message: runtimeResult.message,
      runtimeBinaryPath: runtimeResult.binaryPath,
      checkedAt: runtimeResult.checkedAt,
    };
  }

  return {
    modelId,
    status: "ready",
    lamp: "green",
    message: "Model and whisper.cpp runtime are ready.",
    runtimeBinaryPath: runtimeResult.binaryPath,
    checkedAt: runtimeResult.checkedAt,
  };
};
