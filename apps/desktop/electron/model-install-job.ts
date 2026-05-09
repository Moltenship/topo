import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import { dirname } from "node:path";
import { pipeline } from "node:stream/promises";
import { Effect } from "effect";
import {
  bundledModelCatalog,
  createModelInstallPlan,
  type ModelCatalogEntry,
  verifyDownloadedModel,
} from "@molten-voice/model-catalog";
import type { ModelInstallProgress } from "@molten-voice/shared";

export interface ModelInstallJob {
  readonly getCurrentProgress: () => ModelInstallProgress | null;
  readonly getInstalledModelPath: (modelId: string) => string | null;
  readonly cancel: (modelId: string) => Effect.Effect<void, Error>;
  readonly start: (
    modelId: string,
    onProgressChanged: () => void,
  ) => Effect.Effect<ModelInstallProgress, Error>;
}

export interface FileModelInstallJobOptions {
  readonly installRoot: string;
  readonly fetch: typeof fetch;
  readonly catalog?: readonly ModelCatalogEntry[];
}

const createProgress = (
  modelId: string,
  status: ModelInstallProgress["status"],
  receivedBytes: number,
  totalBytes: number,
  errorMessage: string | null = null,
): ModelInstallProgress => ({
  modelId,
  status,
  receivedBytes,
  totalBytes,
  percent: totalBytes > 0 ? Math.min(1, receivedBytes / totalBytes) : 0,
  errorMessage,
});

const calculateSha256 = (path: string): Effect.Effect<string, Error> =>
  Effect.tryPromise({
    try: async () => {
      const hash = createHash("sha256");
      await pipeline(createReadStream(path), hash);

      return hash.digest("hex");
    },
    catch: (error) => (error instanceof Error ? error : new Error(String(error))),
  });

const readContentLength = (response: Response): number | null => {
  const value = response.headers.get("content-length");

  if (!value) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

export const createFileModelInstallJob = ({
  installRoot,
  fetch,
  catalog = bundledModelCatalog,
}: FileModelInstallJobOptions): ModelInstallJob => {
  let currentProgress: ModelInstallProgress | null = null;
  let activeAbortController: AbortController | null = null;
  let activeModelId: string | null = null;

  const setProgress = (progress: ModelInstallProgress, onProgressChanged: () => void) => {
    currentProgress = progress;
    onProgressChanged();
  };

  return {
    getCurrentProgress: () => currentProgress,
    getInstalledModelPath: (modelId) => {
      const model = catalog.find((model) => model.id === modelId);

      return model ? createModelInstallPlan(model, installRoot).modelFilePath : null;
    },
    cancel: (modelId) =>
      Effect.sync(() => {
        if (activeModelId === modelId) {
          activeAbortController?.abort();
          currentProgress = currentProgress
            ? {
                ...currentProgress,
                status: "canceled",
                errorMessage: null,
              }
            : createProgress(modelId, "canceled", 0, 0);
        }
      }),
    start: (modelId, onProgressChanged) =>
      Effect.gen(function* () {
        const model = catalog.find((model) => model.id === modelId);

        if (!model) {
          return yield* Effect.fail(new Error(`Unknown model: ${modelId}`));
        }

        if (model.source.type === "huggingface-snapshot") {
          return yield* Effect.fail(
            new Error(`Snapshot model downloads are not supported yet: ${modelId}`),
          );
        }

        const plan = createModelInstallPlan(model, installRoot);
        const tempFilePath = `${plan.modelFilePath}.download`;
        const abortController = new AbortController();

        activeAbortController = abortController;
        activeModelId = modelId;

        setProgress(
          createProgress(modelId, "queued", 0, plan.expectedSizeBytes),
          onProgressChanged,
        );
        yield* Effect.tryPromise({
          try: () => mkdir(dirname(tempFilePath), { recursive: true }),
          catch: (error) => (error instanceof Error ? error : new Error(String(error))),
        });

        setProgress(
          createProgress(modelId, "resolving", 0, plan.expectedSizeBytes),
          onProgressChanged,
        );

        const response = yield* Effect.tryPromise({
          try: () => fetch(plan.downloadUrl, { signal: abortController.signal }),
          catch: (error) => (error instanceof Error ? error : new Error(String(error))),
        });

        if (!response.ok || !response.body) {
          return yield* Effect.fail(
            new Error(`Failed to download model ${modelId}: HTTP ${response.status}`),
          );
        }

        const responseSizeBytes = readContentLength(response) ?? plan.expectedSizeBytes;
        const reader = response.body.getReader();
        const writeStream = createWriteStream(tempFilePath);
        let receivedBytes = 0;

        setProgress(
          createProgress(modelId, "downloading", 0, responseSizeBytes),
          onProgressChanged,
        );

        yield* Effect.tryPromise({
          try: async () => {
            try {
              while (true) {
                if (abortController.signal.aborted) {
                  throw new Error("Model install canceled");
                }

                const { done, value } = await reader.read();

                if (done) {
                  break;
                }

                receivedBytes += value.byteLength;
                if (!writeStream.write(value)) {
                  await new Promise<void>((resolve) => writeStream.once("drain", resolve));
                }

                setProgress(
                  createProgress(modelId, "downloading", receivedBytes, responseSizeBytes),
                  onProgressChanged,
                );
              }
            } finally {
              writeStream.end();
              await new Promise<void>((resolve, reject) => {
                writeStream.once("finish", resolve);
                writeStream.once("error", reject);
              });
            }
          },
          catch: (error) => (error instanceof Error ? error : new Error(String(error))),
        });

        setProgress(
          createProgress(modelId, "verifying", receivedBytes, plan.expectedSizeBytes),
          onProgressChanged,
        );

        const fileStat = yield* Effect.tryPromise({
          try: () => stat(tempFilePath),
          catch: (error) => (error instanceof Error ? error : new Error(String(error))),
        });
        const checksumSha256 = yield* calculateSha256(tempFilePath);
        const verification = verifyDownloadedModel(plan, {
          path: tempFilePath,
          sizeBytes: fileStat.size,
          checksumSha256,
        });

        if (verification.status !== "installed") {
          yield* Effect.tryPromise({
            try: () => rm(tempFilePath, { force: true }),
            catch: (error) => (error instanceof Error ? error : new Error(String(error))),
          });

          return yield* Effect.fail(
            new Error(`Downloaded model verification failed: ${verification.reason}`),
          );
        }

        setProgress(
          createProgress(modelId, "installing", receivedBytes, plan.expectedSizeBytes),
          onProgressChanged,
        );
        yield* Effect.tryPromise({
          try: async () => {
            await mkdir(plan.installDirectory, { recursive: true });
            await rename(tempFilePath, plan.modelFilePath);
          },
          catch: (error) => (error instanceof Error ? error : new Error(String(error))),
        });

        const installedProgress = createProgress(
          modelId,
          "installed",
          plan.expectedSizeBytes,
          plan.expectedSizeBytes,
        );
        setProgress(installedProgress, onProgressChanged);
        activeAbortController = null;
        activeModelId = null;

        return installedProgress;
      }).pipe(
        Effect.tapError((error) =>
          Effect.promise(async () => {
            const wasCanceled = activeModelId === modelId && activeAbortController?.signal.aborted;
            const model = catalog.find((model) => model.id === modelId);
            const tempFilePath = model
              ? `${createModelInstallPlan(model, installRoot).modelFilePath}.download`
              : null;

            if (tempFilePath) {
              await rm(tempFilePath, { force: true });
            }

            currentProgress = {
              modelId,
              status: wasCanceled ? "canceled" : "failed",
              receivedBytes: currentProgress?.receivedBytes ?? 0,
              totalBytes: currentProgress?.totalBytes ?? 0,
              percent: currentProgress?.percent ?? 0,
              errorMessage: wasCanceled ? null : error.message,
            };
            activeAbortController = null;
            activeModelId = null;
            onProgressChanged();
          }),
        ),
        Effect.catchAll((error) => {
          if (currentProgress?.status === "canceled") {
            return Effect.succeed(currentProgress);
          }

          return Effect.fail(error);
        }),
      ),
  };
};

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
    getInstalledModelPath: (modelId) => `mock://${modelId}`,
    cancel: (modelId) =>
      Effect.sync(() => {
        if (currentProgress?.modelId === modelId) {
          clearTimer();
          currentProgress = {
            ...currentProgress,
            status: "canceled",
            errorMessage: null,
          };
        }
      }),
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
