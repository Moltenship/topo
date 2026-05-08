import { Effect } from "effect";
import { bundledModelCatalog } from "@molten-voice/model-catalog";
import type { ModelInstallProgress } from "@molten-voice/shared";

export interface ModelInstallJob {
  readonly getCurrentProgress: () => ModelInstallProgress | null;
  readonly start: (
    modelId: string,
    onProgressChanged: () => void,
  ) => Effect.Effect<ModelInstallProgress, Error>;
}

export const createMockModelInstallJob = (): ModelInstallJob => {
  let currentProgress: ModelInstallProgress | null = null;
  let timer: NodeJS.Timeout | null = null;

  const clearTimer = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };

  return {
    getCurrentProgress: () => currentProgress,
    start: (modelId, onProgressChanged) =>
      Effect.gen(function* () {
        const model = bundledModelCatalog.find((model) => model.id === modelId);

        if (!model) {
          return yield* Effect.fail(new Error(`Unknown model: ${modelId}`));
        }

        clearTimer();

        const totalBytes = model.downloadSizeBytes;

        currentProgress = {
          modelId,
          status: "queued",
          receivedBytes: 0,
          totalBytes,
          percent: 0,
          errorMessage: null,
        };

        onProgressChanged();

        timer = setInterval(() => {
          if (!currentProgress || currentProgress.modelId !== modelId) {
            return;
          }

          const nextReceivedBytes = Math.min(
            totalBytes,
            currentProgress.receivedBytes + Math.max(1, Math.round(totalBytes / 12)),
          );
          const percent = nextReceivedBytes / totalBytes;
          const status =
            percent >= 1
              ? "installed"
              : percent > 0.86
                ? "installing"
                : percent > 0.72
                  ? "verifying"
                  : "downloading";

          currentProgress = {
            modelId,
            status,
            receivedBytes: nextReceivedBytes,
            totalBytes,
            percent,
            errorMessage: null,
          };

          onProgressChanged();

          if (status === "installed") {
            clearTimer();
          }
        }, 350);

        return currentProgress;
      }),
  };
};
