import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { Effect, Layer, Tracer } from "effect";
import {
  makeComponentLogger,
  makeLocalFileTracer,
  redactLogAnnotations,
  type LogAnnotations,
} from "@topo/shared";

export const TOPO_LOG_FILE_MAX_BYTES = 10 * 1024 * 1024;
export const TOPO_LOG_FILE_MAX_FILES = 10;
export const TOPO_TRACE_BATCH_WINDOW_MS = 200;
export const TOPO_TRACE_FILE_NAME = "topo.trace.ndjson";
export const TOPO_DIAGNOSTICS_MANIFEST_FILE_NAME = "diagnostics-manifest.json";

export const topoMainLogger = makeComponentLogger("electron-main");

export interface DesktopObservabilityOptions {
  readonly logDir: string;
  readonly runId: string;
  readonly isPackaged: boolean;
  readonly platform: NodeJS.Platform | string;
  readonly arch: string;
}

export interface DiagnosticsManifestInput {
  readonly appVersion: string | null;
  readonly runId: string;
  readonly createdAt?: string;
  readonly platform: NodeJS.Platform | string;
  readonly arch: string;
  readonly isPackaged: boolean;
  readonly logDirectory: string;
  readonly tracePath: string;
  readonly settings: LogAnnotations;
  readonly installedModels: ReadonlyArray<{
    readonly modelId?: string;
    readonly runtime?: string;
    readonly verificationStatus?: string;
  }>;
  readonly installedRuntimes: ReadonlyArray<{
    readonly id?: string;
    readonly engine?: string;
    readonly verificationStatus?: string;
  }>;
  readonly errorMessage: string | null;
}

export interface DiagnosticsManifest {
  readonly appVersion: string | null;
  readonly runId: string;
  readonly createdAt: string;
  readonly platform: string;
  readonly arch: string;
  readonly isPackaged: boolean;
  readonly logDirectory: string;
  readonly tracePath: string;
  readonly settings: LogAnnotations;
  readonly activeModelId: string | null;
  readonly activeRuntime: string | null;
  readonly installedModels: ReadonlyArray<{
    readonly modelId: string | null;
    readonly runtime: string | null;
    readonly status: string | null;
  }>;
  readonly installedRuntimes: ReadonlyArray<{
    readonly id: string | null;
    readonly engine: string | null;
    readonly status: string | null;
  }>;
  readonly errorMessage: string | null;
}

export const resolveLogDirectory = (input: { readonly userDataDirectory: string }): string =>
  join(input.userDataDirectory, "logs");

export const resolveTracePath = (logDir: string): string => join(logDir, TOPO_TRACE_FILE_NAME);

export const makeTopoRunId = (now = new Date()): string => {
  const timestamp = now
    .toISOString()
    .replaceAll("-", "")
    .replaceAll(":", "")
    .replace(/\.\d{3}Z$/, "")
    .replace("T", "-");
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 8);

  return `topo-${timestamp}-${suffix}`;
};

export const makeDesktopObservabilityLayer = (options: DesktopObservabilityOptions) => {
  const tracePath = resolveTracePath(options.logDir);

  mkdirSync(options.logDir, { recursive: true });

  return Layer.unwrapScoped(
    Effect.gen(function* () {
      const tracer = yield* makeLocalFileTracer({
        filePath: tracePath,
        maxBytes: TOPO_LOG_FILE_MAX_BYTES,
        maxFiles: TOPO_LOG_FILE_MAX_FILES,
        batchWindowMs: TOPO_TRACE_BATCH_WINDOW_MS,
      });

      return Layer.mergeAll(
        Layer.succeed(Tracer.Tracer, tracer),
        Layer.scopedDiscard(Effect.withTracerScoped(tracer)),
      );
    }),
  );
};

export function makeDiagnosticsManifest(input: DiagnosticsManifestInput): DiagnosticsManifest {
  const settings = redactLogAnnotations(input.settings);
  const activeModelId =
    typeof input.settings.activeModelId === "string" ? input.settings.activeModelId : null;

  return {
    appVersion: input.appVersion,
    runId: input.runId,
    createdAt: input.createdAt ?? new Date().toISOString(),
    platform: String(input.platform),
    arch: input.arch,
    isPackaged: input.isPackaged,
    logDirectory: input.logDirectory,
    tracePath: input.tracePath,
    settings,
    activeModelId,
    activeRuntime: null,
    installedModels: input.installedModels.map((model) => ({
      modelId: model.modelId ?? null,
      runtime: model.runtime ?? null,
      status: model.verificationStatus ?? null,
    })),
    installedRuntimes: input.installedRuntimes.map((runtime) => ({
      id: runtime.id ?? null,
      engine: runtime.engine ?? null,
      status: runtime.verificationStatus ?? null,
    })),
    errorMessage: input.errorMessage,
  };
}

export const writeDiagnosticsManifest = (
  filePath: string,
  manifest: DiagnosticsManifest,
): Effect.Effect<void> =>
  Effect.sync(() => {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, `${JSON.stringify(manifest, null, 2)}\n`);
  });
