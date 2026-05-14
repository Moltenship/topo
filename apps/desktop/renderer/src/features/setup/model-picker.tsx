import type {
  InstallBundleProgress,
  InstalledModelRecord,
  ModelInstallProgress,
  ModelReadinessRecord,
} from "@topo/shared";
import { getBundledModelCatalog } from "@topo/model-catalog";
import { getRendererApi } from "@/api/renderer-api";
import { ModelCard } from "@/features/models/model-card";

interface ModelPickerProps {
  readonly activeModelId: string | null;
  readonly bundleProgress: InstallBundleProgress | null;
  readonly installedModels: readonly InstalledModelRecord[];
  readonly installProgress: ModelInstallProgress | null;
  readonly modelReadiness: readonly ModelReadinessRecord[];
  readonly onCancelModelInstall: (modelId: string) => void;
  readonly onInstallModel: (modelId: string) => void;
  readonly onSelectModel: (modelId: string) => void;
}

export const ModelPicker = ({
  activeModelId,
  bundleProgress,
  installedModels,
  installProgress,
  modelReadiness,
  onCancelModelInstall,
  onInstallModel,
  onSelectModel,
}: ModelPickerProps) => {
  const platform = getRendererApi().platform;
  const modelCatalog = getBundledModelCatalog({ includeDev: import.meta.env.DEV })
    .filter((model) => model.platforms.includes(platform === "linux" ? "windows" : platform))
    .sort((left, right) => {
      const leftActive = left.id === activeModelId ? 1 : 0;
      const rightActive = right.id === activeModelId ? 1 : 0;
      const leftInstalled = installedModels.some((model) => model.modelId === left.id) ? 1 : 0;
      const rightInstalled = installedModels.some((model) => model.modelId === right.id) ? 1 : 0;
      const leftRecommended = left.badges.includes("recommended") ? 1 : 0;
      const rightRecommended = right.badges.includes("recommended") ? 1 : 0;

      return (
        rightRecommended - leftRecommended ||
        rightActive - leftActive ||
        rightInstalled - leftInstalled ||
        left.downloadSizeBytes - right.downloadSizeBytes
      );
    });

  return (
    <div className="grid grid-cols-3 gap-2.5 max-md:grid-cols-1">
      {modelCatalog.map((model) => {
        return (
          <ModelCard
            active={activeModelId === model.id}
            bundleProgress={bundleProgress?.modelId === model.id ? bundleProgress : null}
            installedModel={
              installedModels.find((installed) => installed.modelId === model.id) ?? null
            }
            key={model.id}
            model={model}
            modelProgress={installProgress?.modelId === model.id ? installProgress : null}
            readiness={modelReadiness.find((record) => record.modelId === model.id) ?? null}
            onCancelInstall={onCancelModelInstall}
            onInstall={onInstallModel}
            onSelect={onSelectModel}
          />
        );
      })}
    </div>
  );
};
