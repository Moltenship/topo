import { Effect } from "effect";
import type { AsrRuntime, ModelCatalogEntry } from "@topo/model-catalog";
import type {
  InstalledModelRecord,
  InstalledRuntimeRecord,
  ModelReadinessRecord,
} from "@topo/shared";
import type { WhisperCppRuntimeResolver, WhisperCppRuntimeResult } from "./whisper-cpp-runtime";

export interface ComputeModelReadinessInput {
  readonly modelId: string;
  readonly runtime: AsrRuntime;
  readonly installedModel: InstalledModelRecord | null;
  readonly installedRuntime: InstalledRuntimeRecord | null;
  readonly runtimeResult: WhisperCppRuntimeResult | null;
}

export interface ComputeModelReadinessForCatalogInput {
  readonly catalog: readonly ModelCatalogEntry[];
  readonly installedModels: readonly InstalledModelRecord[];
  readonly installedRuntimes: readonly InstalledRuntimeRecord[];
  readonly whisperCppRuntimeResult: WhisperCppRuntimeResult | null;
}

export interface WhisperCppRuntimeReadinessCache {
  readonly resolve: (
    resolver: WhisperCppRuntimeResolver,
  ) => Effect.Effect<WhisperCppRuntimeResult, never>;
  readonly clear: () => void;
}

export interface WhisperCppRuntimeReadinessCacheOptions {
  readonly ttlMs?: number;
  readonly now?: () => number;
}

interface CachedWhisperCppRuntimeResult {
  readonly result: WhisperCppRuntimeResult;
  readonly expiresAtMs: number;
}

export const defaultWhisperCppRuntimeReadinessTtlMs = 30_000;

const nowIso = (): string => new Date().toISOString();

const checkedAtFor = (runtimeResult: WhisperCppRuntimeResult | null): string =>
  runtimeResult?.checkedAt ?? nowIso();

export const computeModelReadiness = ({
  modelId,
  runtime,
  installedModel,
  installedRuntime,
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
    if (installedRuntime?.verificationStatus === "verified") {
      return {
        modelId,
        status: "ready",
        lamp: "green",
        message: `Model and ${runtime} runtime are ready.`,
        runtimeBinaryPath: installedRuntime.binaryPath,
        checkedAt: installedRuntime.lastProbedAt ?? checkedAtFor(runtimeResult),
      };
    }

    return {
      modelId,
      status: "runtime-missing",
      lamp: "yellow",
      message: `${runtime} runtime is not implemented yet.`,
      runtimeBinaryPath: null,
      checkedAt: checkedAtFor(runtimeResult),
    };
  }

  if (installedRuntime && installedRuntime.verificationStatus !== "verified") {
    return {
      modelId,
      status: "runtime-failed",
      lamp: "red",
      message: `Installed runtime ${installedRuntime.runtimeId} is ${installedRuntime.verificationStatus}.`,
      runtimeBinaryPath: installedRuntime.binaryPath,
      checkedAt: installedRuntime.lastProbedAt ?? checkedAtFor(runtimeResult),
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

export const computeModelReadinessForCatalog = ({
  catalog,
  installedModels,
  installedRuntimes,
  whisperCppRuntimeResult,
}: ComputeModelReadinessForCatalogInput): readonly ModelReadinessRecord[] => {
  const installedModelsByModelId = new Map(
    installedModels.map((model) => [model.modelId, model] as const),
  );
  const installedRuntimesByRuntimeId = new Map(
    installedRuntimes.map((runtime) => [runtime.runtimeId, runtime] as const),
  );

  return catalog.map((model) =>
    computeModelReadiness({
      modelId: model.id,
      runtime: model.runtime,
      installedModel: installedModelsByModelId.get(model.id) ?? null,
      installedRuntime:
        model.runtimeRequirement.supportedRuntimeIds
          .map((runtimeId) => installedRuntimesByRuntimeId.get(runtimeId))
          .find((runtime) => runtime !== undefined) ?? null,
      runtimeResult: model.runtime === "whisper-cpp" ? whisperCppRuntimeResult : null,
    }),
  );
};

export const shouldResolveWhisperCppRuntimeForCatalog = ({
  catalog,
  installedModels,
}: Pick<ComputeModelReadinessForCatalogInput, "catalog" | "installedModels">): boolean => {
  const installedModelsByModelId = new Map(
    installedModels.map((model) => [model.modelId, model] as const),
  );

  return catalog.some((model) => {
    const installedModel = installedModelsByModelId.get(model.id);

    return model.runtime === "whisper-cpp" && installedModel?.verificationStatus === "verified";
  });
};

export const createWhisperCppRuntimeReadinessCache = ({
  ttlMs = defaultWhisperCppRuntimeReadinessTtlMs,
  now = Date.now,
}: WhisperCppRuntimeReadinessCacheOptions = {}): WhisperCppRuntimeReadinessCache => {
  let cachedResult: CachedWhisperCppRuntimeResult | null = null;

  return {
    resolve: (resolver) =>
      Effect.gen(function* () {
        const nowMs = now();

        if (cachedResult && cachedResult.expiresAtMs > nowMs) {
          return cachedResult.result;
        }

        const result = yield* resolver.resolve();

        cachedResult = {
          result,
          expiresAtMs: nowMs + ttlMs,
        };

        return result;
      }),
    clear: () => {
      cachedResult = null;
    },
  };
};
