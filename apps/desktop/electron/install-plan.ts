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
}

export interface InstallPlan {
  readonly model: ModelCatalogEntry;
  readonly runtime: RuntimeCatalogEntry | null;
  readonly modelId: string;
  readonly runtimeId: RuntimeId | null;
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
}: InstallPlanInput): InstallPlan => {
  const model = modelCatalog.find((entry) => entry.id === modelId);

  if (!model) {
    throw new Error(`Unknown model: ${modelId}`);
  }

  const runtime =
    runtimeCatalog.find(
      (entry) =>
        model.runtimeRequirement.supportedRuntimeIds.includes(entry.id) &&
        entry.platform === platform &&
        entry.architecture === architecture,
    ) ?? null;

  if (!runtime && model.runtimeRequirement.supportedRuntimeIds.length > 0) {
    throw new Error(`No compatible runtime for model ${modelId} on ${platform}/${architecture}`);
  }

  const installedModel = installedModels.find((record) => record.modelId === model.id);
  const installedRuntime = runtime
    ? installedRuntimes.find((record) => record.runtimeId === runtime.id)
    : null;

  return {
    model,
    runtime,
    modelId: model.id,
    runtimeId: runtime?.id ?? null,
    installModel: !isVerified(installedModel),
    installRuntime: runtime ? !isVerified(installedRuntime) : false,
  };
};
