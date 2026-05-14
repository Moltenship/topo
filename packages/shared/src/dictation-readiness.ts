import type { AppSettings } from "@topo/contracts";
import type { ModelReadinessRecord } from "./installed-model";

export interface CanStartDictationInput {
  readonly settings: Pick<AppSettings, "activeModelId">;
  readonly modelReadiness: readonly Pick<ModelReadinessRecord, "modelId" | "status">[];
}

export const canStartDictation = ({
  settings,
  modelReadiness,
}: CanStartDictationInput): boolean => {
  if (!settings.activeModelId) {
    return false;
  }

  return modelReadiness.some(
    (model) => model.modelId === settings.activeModelId && model.status === "ready",
  );
};
