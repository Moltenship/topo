import type { ModelCatalogEntry } from "./model-catalog";

export interface HardwareProfile {
  readonly platform: "macos" | "windows";
  readonly architecture: string;
  readonly memoryBytes: number;
  readonly hasNvidiaGpu: boolean;
}

export interface ModelRecommendation {
  readonly recommended: ModelCatalogEntry | null;
  readonly eligible: readonly ModelCatalogEntry[];
}

export const recommendModel = (
  catalog: readonly ModelCatalogEntry[],
  hardware: HardwareProfile,
): ModelRecommendation => {
  const eligible = catalog.filter(
    (model) =>
      model.platforms.includes(hardware.platform) &&
      model.architectures.includes(hardware.architecture) &&
      model.estimatedMemoryBytes <= hardware.memoryBytes,
  );

  const stable = eligible.filter((model) => !model.experimental);
  const nvidiaExperimental = eligible.find(
    (model) => hardware.hasNvidiaGpu && model.runtime === "parakeet",
  );

  return {
    recommended: stable[0] ?? nvidiaExperimental ?? eligible[0] ?? null,
    eligible,
  };
};
