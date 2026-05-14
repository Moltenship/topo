import { access, mkdir, readdir, rename, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { Effect } from "effect";
import {
  bundledRuntimeCatalog,
  resolveDownloadSourceUrl,
  type RuntimeCatalogEntry,
  type RuntimeId,
} from "@topo/model-catalog";
import type { InstalledRuntimeRepository } from "@topo/db";
import type { InstalledRuntimeRecord, ModelInstallProgress } from "@topo/shared";
import {
  calculateFileSha256,
  createInstallProgress,
  readContentLength,
  streamResponseBodyToFile,
} from "./artifact-install-helpers";

export interface RuntimeInstallJob {
  readonly getCurrentProgress: () => ModelInstallProgress | null;
  readonly getInstalledRuntimePath: (runtimeId: RuntimeId) => string | null;
  readonly cancel: (runtimeId: RuntimeId) => Effect.Effect<void, Error>;
  readonly start: (
    runtimeId: RuntimeId,
    onProgressChanged: () => void,
  ) => Effect.Effect<ModelInstallProgress, Error>;
}

export interface RuntimeProbeResult {
  readonly ok: boolean;
  readonly message: string | null;
}

export interface FileRuntimeInstallJobOptions {
  readonly installRoot: string;
  readonly fetch: typeof fetch;
  readonly repository: InstalledRuntimeRepository;
  readonly catalog?: readonly RuntimeCatalogEntry[];
  readonly extractArchive?: (archivePath: string, targetDirectory: string) => Promise<void>;
  readonly probeRuntime?: (
    binaryPath: string | null,
    runtime: RuntimeCatalogEntry,
  ) => Promise<RuntimeProbeResult>;
  readonly now?: () => Date;
}

const defaultExtractArchive = async (archivePath: string, targetDirectory: string) => {
  const extract = (await import("extract-zip")).default;

  await extract(archivePath, { dir: targetDirectory });
};

const defaultProbeRuntime = async (binaryPath: string | null): Promise<RuntimeProbeResult> => {
  if (!binaryPath) {
    return { ok: true, message: "system runtime" };
  }

  await access(binaryPath);

  return { ok: true, message: "binary exists" };
};

const runtimeDirectory = (installRoot: string, runtimeId: string): string =>
  join(installRoot, runtimeId);

const runtimeArchivePath = (installRoot: string, runtimeId: string): string =>
  join(runtimeDirectory(installRoot, runtimeId), `${runtimeId}.zip.download`);

const runtimeExtractingDirectory = (installRoot: string, runtimeId: string): string =>
  join(runtimeDirectory(installRoot, runtimeId), ".extracting");

const runtimeBinaryPath = (installRoot: string, runtime: RuntimeCatalogEntry): string | null =>
  runtime.binaryRelativePath
    ? join(runtimeDirectory(installRoot, runtime.id), runtime.binaryRelativePath)
    : null;

const makeInstalledRuntimeRecord = ({
  installRoot,
  runtime,
  checksumSha256,
  probeMessage,
  now,
}: {
  readonly installRoot: string;
  readonly runtime: RuntimeCatalogEntry;
  readonly checksumSha256: string | null;
  readonly probeMessage: string | null;
  readonly now: () => Date;
}): InstalledRuntimeRecord => {
  const timestamp = now().toISOString();

  return {
    id: `installed_${runtime.id}`,
    runtimeId: runtime.id,
    engine: runtime.engine,
    installedPath: runtimeDirectory(installRoot, runtime.id),
    binaryPath: runtimeBinaryPath(installRoot, runtime),
    checksumSha256,
    verificationStatus: "verified",
    installedAt: timestamp,
    lastProbedAt: timestamp,
    lastProbeMessage: probeMessage,
  };
};

export const createFileRuntimeInstallJob = ({
  installRoot,
  fetch,
  repository,
  catalog = bundledRuntimeCatalog,
  extractArchive = defaultExtractArchive,
  probeRuntime = defaultProbeRuntime,
  now = () => new Date(),
}: FileRuntimeInstallJobOptions): RuntimeInstallJob => {
  let currentProgress: ModelInstallProgress | null = null;
  let activeAbortController: AbortController | null = null;
  let activeRuntimeId: RuntimeId | null = null;

  const setProgress = (progress: ModelInstallProgress, onProgressChanged: () => void) => {
    currentProgress = progress;
    onProgressChanged();
  };

  const cleanupTempPaths = async (runtimeId: RuntimeId) => {
    await rm(runtimeArchivePath(installRoot, runtimeId), { force: true });
    await rm(runtimeExtractingDirectory(installRoot, runtimeId), { force: true, recursive: true });
  };

  return {
    getCurrentProgress: () => currentProgress,
    getInstalledRuntimePath: (runtimeId) =>
      catalog.some((runtime) => runtime.id === runtimeId)
        ? runtimeDirectory(installRoot, runtimeId)
        : null,
    cancel: (runtimeId) =>
      Effect.sync(() => {
        if (activeRuntimeId === runtimeId) {
          activeAbortController?.abort();
          currentProgress = currentProgress
            ? {
                ...currentProgress,
                status: "canceled",
                errorMessage: null,
              }
            : createInstallProgress(runtimeId, "canceled", 0, 0);
        }
      }),
    start: (runtimeId, onProgressChanged) =>
      Effect.gen(function* () {
        const runtime = catalog.find((entry) => entry.id === runtimeId);

        if (!runtime) {
          return yield* Effect.fail(new Error(`Unknown runtime: ${runtimeId}`));
        }

        const installDirectory = runtimeDirectory(installRoot, runtime.id);
        const archivePath = runtimeArchivePath(installRoot, runtime.id);
        const extractingDirectory = runtimeExtractingDirectory(installRoot, runtime.id);
        const expectedSizeBytes = runtime.downloadSizeBytes;
        const abortController = new AbortController();

        activeAbortController = abortController;
        activeRuntimeId = runtime.id;

        setProgress(
          createInstallProgress(runtime.id, "queued", 0, expectedSizeBytes),
          onProgressChanged,
        );
        yield* Effect.tryPromise({
          try: () => mkdir(installDirectory, { recursive: true }),
          catch: (error) => (error instanceof Error ? error : new Error(String(error))),
        });

        setProgress(
          createInstallProgress(runtime.id, "resolving", 0, expectedSizeBytes),
          onProgressChanged,
        );

        if (runtime.source.type === "system") {
          const probe = yield* Effect.tryPromise({
            try: () => probeRuntime(null, runtime),
            catch: (error) => (error instanceof Error ? error : new Error(String(error))),
          });

          if (!probe.ok) {
            return yield* Effect.fail(new Error(`Runtime probe failed: ${probe.message}`));
          }

          yield* repository.upsert(
            makeInstalledRuntimeRecord({
              installRoot,
              runtime,
              checksumSha256: null,
              probeMessage: probe.message,
              now,
            }),
          );

          const installedProgress = createInstallProgress(runtime.id, "installed", 0, 0);
          setProgress(installedProgress, onProgressChanged);
          activeAbortController = null;
          activeRuntimeId = null;

          return installedProgress;
        }

        const downloadUrl = resolveDownloadSourceUrl(runtime.source);
        const response = yield* Effect.tryPromise({
          try: () => fetch(downloadUrl, { signal: abortController.signal }),
          catch: (error) => (error instanceof Error ? error : new Error(String(error))),
        });

        if (abortController.signal.aborted) {
          return yield* Effect.fail(new Error("Runtime install canceled"));
        }

        if (!response.ok || !response.body) {
          return yield* Effect.fail(
            new Error(`Failed to download runtime ${runtime.id}: HTTP ${response.status}`),
          );
        }

        const responseSizeBytes = readContentLength(response) ?? expectedSizeBytes;
        setProgress(
          createInstallProgress(runtime.id, "downloading", 0, responseSizeBytes),
          onProgressChanged,
        );

        yield* streamResponseBodyToFile({
          response,
          filePath: archivePath,
          abortSignal: abortController.signal,
          onChunk: (receivedBytes) => {
            setProgress(
              createInstallProgress(runtime.id, "downloading", receivedBytes, responseSizeBytes),
              onProgressChanged,
            );
          },
        });

        setProgress(
          createInstallProgress(
            runtime.id,
            "verifying",
            currentProgress?.receivedBytes ?? expectedSizeBytes,
            expectedSizeBytes,
          ),
          onProgressChanged,
        );

        const fileStat = yield* Effect.tryPromise({
          try: () => stat(archivePath),
          catch: (error) => (error instanceof Error ? error : new Error(String(error))),
        });
        const checksumSha256 = yield* calculateFileSha256(archivePath);

        if (runtime.checksumSha256 && checksumSha256 !== runtime.checksumSha256) {
          yield* Effect.tryPromise({
            try: () => cleanupTempPaths(runtime.id),
            catch: (error) => (error instanceof Error ? error : new Error(String(error))),
          });

          return yield* Effect.fail(new Error("Downloaded runtime verification failed: checksum"));
        }

        if (runtime.downloadSizeBytes > 0 && fileStat.size !== runtime.downloadSizeBytes) {
          yield* Effect.tryPromise({
            try: () => cleanupTempPaths(runtime.id),
            catch: (error) => (error instanceof Error ? error : new Error(String(error))),
          });

          return yield* Effect.fail(new Error("Downloaded runtime verification failed: size"));
        }

        setProgress(
          createInstallProgress(
            runtime.id,
            "installing",
            currentProgress?.receivedBytes ?? expectedSizeBytes,
            expectedSizeBytes,
          ),
          onProgressChanged,
        );

        yield* Effect.tryPromise({
          try: async () => {
            await rm(extractingDirectory, { force: true, recursive: true });
            await extractArchive(archivePath, extractingDirectory);

            const extractedBinaryPath = runtime.binaryRelativePath
              ? join(extractingDirectory, runtime.binaryRelativePath)
              : null;

            if (extractedBinaryPath) {
              await access(extractedBinaryPath);
            }

            for (const entry of await readdir(installDirectory)) {
              if (entry === ".extracting" || entry === `${runtime.id}.zip.download`) {
                continue;
              }

              await rm(join(installDirectory, entry), { force: true, recursive: true });
            }

            for (const entry of await readdir(extractingDirectory)) {
              await rename(join(extractingDirectory, entry), join(installDirectory, entry));
            }

            await rm(extractingDirectory, { force: true, recursive: true });
            await rm(archivePath, { force: true });
          },
          catch: (error) => (error instanceof Error ? error : new Error(String(error))),
        });

        const binaryPath = runtimeBinaryPath(installRoot, runtime);
        const probe = yield* Effect.tryPromise({
          try: () => probeRuntime(binaryPath, runtime),
          catch: (error) => (error instanceof Error ? error : new Error(String(error))),
        });

        if (!probe.ok) {
          yield* Effect.tryPromise({
            try: () => rm(installDirectory, { force: true, recursive: true }),
            catch: (error) => (error instanceof Error ? error : new Error(String(error))),
          });

          yield* Effect.tryPromise({
            try: () => mkdir(installDirectory, { recursive: true }),
            catch: (error) => (error instanceof Error ? error : new Error(String(error))),
          });

          return yield* Effect.fail(new Error(`Runtime probe failed: ${probe.message}`));
        }

        yield* repository.upsert(
          makeInstalledRuntimeRecord({
            installRoot,
            runtime,
            checksumSha256,
            probeMessage: probe.message,
            now,
          }),
        );

        const installedProgress = createInstallProgress(
          runtime.id,
          "installed",
          expectedSizeBytes,
          expectedSizeBytes,
        );
        setProgress(installedProgress, onProgressChanged);
        activeAbortController = null;
        activeRuntimeId = null;

        return installedProgress;
      }).pipe(
        Effect.tapError((error) =>
          Effect.promise(async () => {
            const wasCanceled =
              activeRuntimeId === runtimeId && activeAbortController?.signal.aborted;

            await cleanupTempPaths(runtimeId);

            currentProgress = {
              modelId: runtimeId,
              status: wasCanceled ? "canceled" : "failed",
              receivedBytes: currentProgress?.receivedBytes ?? 0,
              totalBytes: currentProgress?.totalBytes ?? 0,
              percent: currentProgress?.percent ?? 0,
              errorMessage: wasCanceled ? null : error.message,
            };
            activeAbortController = null;
            activeRuntimeId = null;
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
