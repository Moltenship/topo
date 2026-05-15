import type {
  ModelCatalogEntry,
  RuntimeCatalogEntry,
  RuntimeId,
  RuntimePlatform,
} from "@topo/model-catalog";
import type { InstalledModelRecord, InstalledRuntimeRecord } from "@topo/shared";

export interface InstallPlanInput {
  readonly modelId: string;
  readonly platform: RuntimePlatform;
  readonly architecture: string;
  readonly modelCatalog: readonly ModelCatalogEntry[];
  readonly runtimeCatalog: readonly RuntimeCatalogEntry[];
  readonly installedModels: readonly InstalledModelRecord[];
  readonly installedRuntimes: readonly InstalledRuntimeRecord[];
  readonly whisperCppAccelerator?: "auto" | "cpu" | "gpu";
}

export interface InstallPlan {
  readonly model: ModelCatalogEntry;
  readonly runtime: RuntimeCatalogEntry | null;
  readonly runtimeInstallQueue: readonly {
    readonly runtime: RuntimeCatalogEntry;
    readonly required: boolean;
  }[];
  readonly modelId: string;
  readonly runtimeId: RuntimeId | null;
  readonly runtimeIds: readonly RuntimeId[];
  readonly installModel: boolean;
  readonly installRuntime: boolean;
}

const isVerified = (record: { readonly verificationStatus: string } | null | undefined): boolean =>
  record?.verificationStatus === "verified";

export const createInstallPlan = ({
  modelId,
  platform,
  architecture,
  modelCatalog,
  runtimeCatalog,
  installedModels,
  installedRuntimes,
  whisperCppAccelerator = "auto",
}: InstallPlanInput): InstallPlan => {
  const model = modelCatalog.find((entry) => entry.id === modelId);

  if (!model) {
    throw new Error(`Unknown model: ${modelId}`);
  }

  const compatibleRuntimes = runtimeCatalog.filter(
    (entry) =>
      model.runtimeRequirement.supportedRuntimeIds.includes(entry.id) &&
      entry.platform === platform &&
      entry.architecture === architecture,
  );
  const runtime = selectPrimaryRuntime(compatibleRuntimes, model.runtime, whisperCppAccelerator);

  if (compatibleRuntimes.length === 0 && model.runtimeRequirement.supportedRuntimeIds.length > 0) {
    throw new Error(`No compatible runtime for model ${modelId} on ${platform}/${architecture}`);
  }

  const installedModel = installedModels.find((record) => record.modelId === model.id);
  const runtimeInstallQueue = createRuntimeInstallQueue({
    modelRuntime: model.runtime,
    compatibleRuntimes,
    installedRuntimes,
    whisperCppAccelerator,
  });

  return {
    model,
    runtime,
    runtimeInstallQueue,
    modelId: model.id,
    runtimeId: runtime?.id ?? null,
    runtimeIds: runtimeInstallQueue.map((entry) => entry.runtime.id),
    installModel: !isVerified(installedModel),
    installRuntime: runtimeInstallQueue.length > 0,
  };
};

const selectPrimaryRuntime = (
  compatibleRuntimes: readonly RuntimeCatalogEntry[],
  modelRuntime: ModelCatalogEntry["runtime"],
  whisperCppAccelerator: "auto" | "cpu" | "gpu",
): RuntimeCatalogEntry | null => {
  if (modelRuntime !== "whisper-cpp") {
    return compatibleRuntimes[0] ?? null;
  }

  if (whisperCppAccelerator === "cpu") {
    return compatibleRuntimes.find((runtime) => runtime.accelerator === "cpu") ?? null;
  }

  return (
    compatibleRuntimes.find((runtime) => runtime.accelerator === "cuda") ??
    compatibleRuntimes.find((runtime) => runtime.accelerator === "cpu") ??
    null
  );
};

const createRuntimeInstallQueue = ({
  modelRuntime,
  compatibleRuntimes,
  installedRuntimes,
  whisperCppAccelerator,
}: {
  readonly modelRuntime: ModelCatalogEntry["runtime"];
  readonly compatibleRuntimes: readonly RuntimeCatalogEntry[];
  readonly installedRuntimes: readonly InstalledRuntimeRecord[];
  readonly whisperCppAccelerator: "auto" | "cpu" | "gpu";
}): InstallPlan["runtimeInstallQueue"] => {
  const installedByRuntimeId = new Map(
    installedRuntimes.map((runtime) => [runtime.runtimeId, runtime] as const),
  );
  const needsInstall = (runtime: RuntimeCatalogEntry): boolean =>
    !isVerified(installedByRuntimeId.get(runtime.id));

  if (modelRuntime !== "whisper-cpp") {
    return compatibleRuntimes.filter(needsInstall).map((runtime) => ({
      runtime,
      required: true,
    }));
  }

  const cpuRuntime = compatibleRuntimes.find((runtime) => runtime.accelerator === "cpu") ?? null;
  const cudaRuntime = compatibleRuntimes.find((runtime) => runtime.accelerator === "cuda") ?? null;
  const queue: InstallPlan["runtimeInstallQueue"][number][] = [];

  if (cpuRuntime && needsInstall(cpuRuntime)) {
    queue.push({ runtime: cpuRuntime, required: true });
  }

  if (whisperCppAccelerator !== "cpu" && cudaRuntime && needsInstall(cudaRuntime)) {
    queue.push({ runtime: cudaRuntime, required: whisperCppAccelerator === "gpu" });
  }

  return queue;
};
