import type { ModelCatalogEntry } from "./model-catalog";
import { getCatalogModelDownloadUrl } from "./model-catalog";

export type ModelInstallStatus = "not-installed" | "downloading" | "installed" | "corrupt";

export interface ModelInstallPlan {
  readonly modelId: string;
  readonly downloadUrl: string;
  readonly expectedChecksumSha256: string;
  readonly expectedSizeBytes: number;
  readonly installDirectory: string;
  readonly installStrategy: ModelCatalogEntry["installStrategy"];
  readonly installedPath: string;
  readonly archivePath: string | null;
  readonly modelFilePath: string;
}

export interface DownloadedModelFile {
  readonly path: string;
  readonly sizeBytes: number;
  readonly checksumSha256: string;
}

export interface ModelVerificationResult {
  readonly status: Exclude<ModelInstallStatus, "downloading">;
  readonly reason: "ok" | "missing" | "size-mismatch" | "checksum-mismatch";
}

const normalizeRoot = (installRoot: string): string => installRoot.replace(/[\\/]+$/, "");

const modelFileName = (model: ModelCatalogEntry): string => `${model.id}.bin`;

export const createModelInstallPlan = (
  model: ModelCatalogEntry,
  installRoot: string,
): ModelInstallPlan => {
  const root = normalizeRoot(installRoot);
  const installDirectory = `${root}/${model.id}`;
  const modelFilePath = `${installDirectory}/${modelFileName(model)}`;
  const archivePath =
    model.installStrategy.type === "archive-directory"
      ? `${installDirectory}/${model.id}.zip.download`
      : null;

  return {
    modelId: model.id,
    downloadUrl: getCatalogModelDownloadUrl(model),
    expectedChecksumSha256: model.checksumSha256,
    expectedSizeBytes: model.downloadSizeBytes,
    installDirectory,
    installStrategy: model.installStrategy,
    installedPath:
      model.installStrategy.type === "archive-directory" ? installDirectory : modelFilePath,
    archivePath,
    modelFilePath,
  };
};

export const verifyDownloadedModel = (
  plan: ModelInstallPlan,
  file: DownloadedModelFile | null,
): ModelVerificationResult => {
  if (!file) {
    return { status: "not-installed", reason: "missing" };
  }

  if (file.sizeBytes !== plan.expectedSizeBytes) {
    return { status: "corrupt", reason: "size-mismatch" };
  }

  if (file.checksumSha256 !== plan.expectedChecksumSha256) {
    return { status: "corrupt", reason: "checksum-mismatch" };
  }

  return { status: "installed", reason: "ok" };
};
