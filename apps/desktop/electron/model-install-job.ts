import { createReadStream, createWriteStream } from "node:fs";
import { access, mkdir, readdir, rename, rm, stat } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";
import { pipeline } from "node:stream/promises";
import { Effect } from "effect";
import {
  bundledModelCatalog,
  createModelInstallPlan,
  type ModelCatalogEntry,
  verifyDownloadedModel,
} from "@topo/model-catalog";
import type { ModelInstallProgress } from "@topo/shared";
import {
  calculateFileSha256,
  createInstallProgress,
  readContentLength,
  streamResponseBodyToFile,
} from "./artifact-install-helpers";
import {
  downloadHuggingFaceSnapshotFile,
  listHuggingFaceSnapshotFiles,
} from "./huggingface-snapshot";

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
  readonly resourcesRoot?: string;
  readonly fetch: typeof fetch;
  readonly catalog?: readonly ModelCatalogEntry[];
  readonly extractArchive?: (archivePath: string, targetDirectory: string) => Promise<void>;
}

const defaultExtractArchive = async (archivePath: string, targetDirectory: string) => {
  const extract = (await import("extract-zip")).default;

  await extract(archivePath, { dir: targetDirectory });
};

const validateRequiredFiles = async (
  directory: string,
  requiredFiles: readonly string[],
): Promise<void> => {
  for (const requiredFile of requiredFiles) {
    try {
      await access(join(directory, requiredFile));
    } catch {
      throw new Error(`Missing required model file: ${requiredFile}`);
    }
  }
};

export const createFileModelInstallJob = ({
  installRoot,
  resourcesRoot,
  fetch,
  catalog = bundledModelCatalog,
  extractArchive = defaultExtractArchive,
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

      return model ? createModelInstallPlan(model, installRoot).installedPath : null;
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
            : createInstallProgress(modelId, "canceled", 0, 0);
        }
      }),
    start: (modelId, onProgressChanged) =>
      Effect.gen(function* () {
        const model = catalog.find((model) => model.id === modelId);

        if (!model) {
          return yield* Effect.fail(new Error(`Unknown model: ${modelId}`));
        }

        const plan = createModelInstallPlan(model, installRoot);
        const tempFilePath = plan.archivePath ?? `${plan.modelFilePath}.download`;
        const extractingDirectory = join(plan.installDirectory, ".extracting");
        const abortController = new AbortController();

        activeAbortController = abortController;
        activeModelId = modelId;

        setProgress(
          createInstallProgress(modelId, "queued", 0, plan.expectedSizeBytes),
          onProgressChanged,
        );
        yield* Effect.tryPromise({
          try: () => mkdir(dirname(tempFilePath), { recursive: true }),
          catch: (error) => (error instanceof Error ? error : new Error(String(error))),
        });

        setProgress(
          createInstallProgress(modelId, "resolving", 0, plan.expectedSizeBytes),
          onProgressChanged,
        );

        if (
          model.source.type === "huggingface-snapshot" &&
          plan.installStrategy.type === "huggingface-snapshot-directory"
        ) {
          const installStrategy = plan.installStrategy;
          const files = yield* listHuggingFaceSnapshotFiles({
            source: model.source,
            fetch,
          });
          const totalSizeBytes =
            files.reduce((total, file) => total + file.sizeBytes, 0) || plan.expectedSizeBytes;
          let receivedBytes = 0;

          yield* Effect.tryPromise({
            try: async () => {
              await rm(extractingDirectory, { force: true, recursive: true });
              await mkdir(extractingDirectory, { recursive: true });
            },
            catch: (error) => (error instanceof Error ? error : new Error(String(error))),
          });

          setProgress(
            createInstallProgress(modelId, "downloading", 0, totalSizeBytes),
            onProgressChanged,
          );

          for (const file of files) {
            const fileStartBytes = receivedBytes;
            yield* downloadHuggingFaceSnapshotFile({
              file,
              targetDirectory: extractingDirectory,
              fetch,
              abortSignal: abortController.signal,
              onChunk: (fileReceivedBytes) => {
                receivedBytes = fileStartBytes + fileReceivedBytes;
                setProgress(
                  createInstallProgress(modelId, "downloading", receivedBytes, totalSizeBytes),
                  onProgressChanged,
                );
              },
            });
          }

          setProgress(
            createInstallProgress(modelId, "verifying", receivedBytes, totalSizeBytes),
            onProgressChanged,
          );
          yield* Effect.tryPromise({
            try: () => validateRequiredFiles(extractingDirectory, installStrategy.requiredFiles),
            catch: (error) => (error instanceof Error ? error : new Error(String(error))),
          });

          setProgress(
            createInstallProgress(modelId, "installing", receivedBytes, totalSizeBytes),
            onProgressChanged,
          );
          yield* Effect.tryPromise({
            try: async () => {
              await mkdir(plan.installDirectory, { recursive: true });
              for (const entry of await readdir(plan.installDirectory)) {
                if (entry === ".extracting") {
                  continue;
                }

                await rm(join(plan.installDirectory, entry), { force: true, recursive: true });
              }

              for (const entry of await readdir(extractingDirectory)) {
                await rename(join(extractingDirectory, entry), join(plan.installDirectory, entry));
              }

              await rm(extractingDirectory, { force: true, recursive: true });
            },
            catch: (error) => (error instanceof Error ? error : new Error(String(error))),
          });

          const installedProgress = createInstallProgress(
            modelId,
            "installed",
            totalSizeBytes,
            totalSizeBytes,
          );
          setProgress(installedProgress, onProgressChanged);
          activeAbortController = null;
          activeModelId = null;

          return installedProgress;
        }

        if (model.source.type === "huggingface-snapshot") {
          return yield* Effect.fail(
            new Error(`Snapshot model install strategy is not supported: ${modelId}`),
          );
        }

        if (model.source.type === "local-file") {
          if (!resourcesRoot) {
            return yield* Effect.fail(new Error("Local model resources root is not configured"));
          }

          const sourcePath = normalize(join(resourcesRoot, model.source.relativePath));

          setProgress(
            createInstallProgress(modelId, "downloading", 0, plan.expectedSizeBytes),
            onProgressChanged,
          );

          yield* Effect.tryPromise({
            try: async () => {
              const readStream = createReadStream(sourcePath);
              const writeStream = createWriteStream(tempFilePath);
              let receivedBytes = 0;

              readStream.on("data", (chunk) => {
                receivedBytes += chunk.length;
                setProgress(
                  createInstallProgress(
                    modelId,
                    "downloading",
                    receivedBytes,
                    plan.expectedSizeBytes,
                  ),
                  onProgressChanged,
                );
              });

              await pipeline(readStream, writeStream);
            },
            catch: (error) => (error instanceof Error ? error : new Error(String(error))),
          });
        } else {
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

          setProgress(
            createInstallProgress(modelId, "downloading", 0, responseSizeBytes),
            onProgressChanged,
          );

          yield* streamResponseBodyToFile({
            response,
            filePath: tempFilePath,
            abortSignal: abortController.signal,
            onChunk: (receivedBytes) => {
              setProgress(
                createInstallProgress(modelId, "downloading", receivedBytes, responseSizeBytes),
                onProgressChanged,
              );
            },
          });
        }

        setProgress(
          createInstallProgress(
            modelId,
            "verifying",
            currentProgress?.receivedBytes ?? plan.expectedSizeBytes,
            plan.expectedSizeBytes,
          ),
          onProgressChanged,
        );

        const fileStat = yield* Effect.tryPromise({
          try: () => stat(tempFilePath),
          catch: (error) => (error instanceof Error ? error : new Error(String(error))),
        });
        const checksumSha256 = yield* calculateFileSha256(tempFilePath);
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
          createInstallProgress(
            modelId,
            "installing",
            currentProgress?.receivedBytes ?? plan.expectedSizeBytes,
            plan.expectedSizeBytes,
          ),
          onProgressChanged,
        );
        yield* Effect.tryPromise({
          try: async () => {
            await mkdir(plan.installDirectory, { recursive: true });
            if (plan.installStrategy.type === "single-file") {
              await rename(tempFilePath, plan.modelFilePath);

              return;
            }

            await rm(extractingDirectory, { force: true, recursive: true });
            await mkdir(extractingDirectory, { recursive: true });
            await extractArchive(tempFilePath, extractingDirectory);
            await validateRequiredFiles(extractingDirectory, plan.installStrategy.requiredFiles);

            for (const entry of await readdir(plan.installDirectory)) {
              if (entry === ".extracting" || entry === `${model.id}.zip.download`) {
                continue;
              }

              await rm(join(plan.installDirectory, entry), { force: true, recursive: true });
            }

            for (const entry of await readdir(extractingDirectory)) {
              await rename(join(extractingDirectory, entry), join(plan.installDirectory, entry));
            }

            await rm(extractingDirectory, { force: true, recursive: true });
            await rm(tempFilePath, { force: true });
          },
          catch: (error) => (error instanceof Error ? error : new Error(String(error))),
        });

        const installedProgress = createInstallProgress(
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
            const plan = model ? createModelInstallPlan(model, installRoot) : null;
            const tempFilePath = plan
              ? (plan.archivePath ?? `${plan.modelFilePath}.download`)
              : null;

            if (tempFilePath) {
              await rm(tempFilePath, { force: true });
            }
            if (plan?.installStrategy.type === "archive-directory") {
              await rm(join(plan.installDirectory, ".extracting"), {
                force: true,
                recursive: true,
              });
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
