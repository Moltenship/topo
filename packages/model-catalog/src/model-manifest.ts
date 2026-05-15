import * as Schema from "effect/Schema";
import type {
  ModelCatalogEntry,
  ModelInstallStrategy as CatalogModelInstallStrategy,
} from "./model-catalog";
import { resolveDownloadSourceUrl } from "./download-source";

const RuntimeId = Schema.Literal(
  "whisperkit",
  "whisper-cpp-windows-x64-cpu",
  "whisper-cpp-windows-x64-cuda",
  "whisper-cpp-macos-arm64",
);

const AsrRuntime = Schema.Literal("whisperkit", "whisper-cpp", "parakeet");
const RuntimePlatform = Schema.Literal("macos", "windows");
const Language = Schema.Literal("en", "ru");
const ModelQualityLabel = Schema.Literal("fast", "balanced", "quality");
const ModelSpeedLabel = Schema.Literal("fastest", "fast", "moderate");

const GithubReleaseSource = Schema.Struct({
  type: Schema.Literal("github-release"),
  owner: Schema.String,
  repo: Schema.String,
  tag: Schema.String,
  assetName: Schema.String,
});

const DirectDownloadSource = Schema.Struct({
  type: Schema.Literal("direct-url"),
  url: Schema.String,
});

const HuggingFaceFileSource = Schema.Struct({
  type: Schema.Literal("huggingface-file"),
  repo: Schema.String,
  revision: Schema.String,
  filePath: Schema.String,
});

const HuggingFaceSnapshotSource = Schema.Struct({
  type: Schema.Literal("huggingface-snapshot"),
  repo: Schema.String,
  revision: Schema.String,
  subfolder: Schema.String,
});

const LocalFileSource = Schema.Struct({
  type: Schema.Literal("local-file"),
  relativePath: Schema.String,
});

export const ManifestDownloadSource = Schema.Union(
  GithubReleaseSource,
  DirectDownloadSource,
  HuggingFaceFileSource,
  HuggingFaceSnapshotSource,
  LocalFileSource,
);

export const ManifestModelInstallStrategy = Schema.Union(
  Schema.Struct({ type: Schema.Literal("single-file") }),
  Schema.Struct({
    type: Schema.Literal("archive-directory"),
    requiredFiles: Schema.Array(Schema.String),
  }),
  Schema.Struct({
    type: Schema.Literal("huggingface-snapshot-directory"),
    requiredFiles: Schema.Array(Schema.String),
  }),
);

export const ManifestModelCatalogEntry = Schema.Struct({
  id: Schema.String,
  displayName: Schema.String,
  runtime: AsrRuntime,
  runtimeRequirement: Schema.Struct({
    engine: AsrRuntime,
    supportedRuntimeIds: Schema.Array(RuntimeId),
  }),
  platforms: Schema.Array(RuntimePlatform),
  architectures: Schema.Array(Schema.String),
  languages: Schema.Array(Language),
  source: ManifestDownloadSource,
  installStrategy: ManifestModelInstallStrategy,
  checksumSha256: Schema.String,
  downloadSizeBytes: Schema.Number,
  diskSizeBytes: Schema.Number,
  estimatedMemoryBytes: Schema.Number,
  qualityLabel: ModelQualityLabel,
  speedLabel: ModelSpeedLabel,
  accuracyScore: Schema.Number,
  speedScore: Schema.Number,
  recommendedReason: Schema.String,
  badges: Schema.Array(Schema.String),
  experimental: Schema.Boolean,
  devOnly: Schema.optional(Schema.Boolean),
});

export const ModelCatalogManifest = Schema.Struct({
  schemaVersion: Schema.Literal(1),
  generatedAt: Schema.String,
  models: Schema.Array(ManifestModelCatalogEntry),
});

export type ModelCatalogManifest = typeof ModelCatalogManifest.Type;

export const modelCatalogManifestToCatalog = (
  manifest: ModelCatalogManifest,
): readonly ModelCatalogEntry[] =>
  manifest.models.map((model) => {
    const catalogEntry: ModelCatalogEntry = {
      id: model.id,
      displayName: model.displayName,
      runtime: model.runtime,
      runtimeRequirement: model.runtimeRequirement,
      platforms: model.platforms,
      architectures: model.architectures,
      languages: model.languages,
      source: model.source,
      installStrategy: model.installStrategy as CatalogModelInstallStrategy,
      downloadUrl: resolveDownloadSourceUrl(model.source),
      checksumSha256: model.checksumSha256,
      downloadSizeBytes: model.downloadSizeBytes,
      diskSizeBytes: model.diskSizeBytes,
      estimatedMemoryBytes: model.estimatedMemoryBytes,
      qualityLabel: model.qualityLabel,
      speedLabel: model.speedLabel,
      accuracyScore: model.accuracyScore,
      speedScore: model.speedScore,
      recommendedReason: model.recommendedReason,
      badges: model.badges,
      experimental: model.experimental,
      ...(model.devOnly === undefined ? {} : { devOnly: model.devOnly }),
    };

    return catalogEntry;
  });
