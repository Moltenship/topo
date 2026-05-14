import type { DownloadSource } from "./download-source";
import { resolveDownloadSourceUrl } from "./download-source";
import type { RuntimeId } from "./runtime-catalog";

export type AsrRuntime = "whisperkit" | "whisper-cpp" | "parakeet";
export type ModelQualityLabel = "fast" | "balanced" | "quality";
export type ModelSpeedLabel = "fastest" | "fast" | "moderate";
export type ModelInstallStrategy =
  | { readonly type: "single-file" }
  | {
      readonly type: "archive-directory";
      readonly requiredFiles: readonly string[];
    }
  | {
      readonly type: "huggingface-snapshot-directory";
      readonly requiredFiles: readonly string[];
    };

export interface ModelCatalogEntry {
  readonly id: string;
  readonly displayName: string;
  readonly runtime: AsrRuntime;
  readonly runtimeRequirement: {
    readonly engine: AsrRuntime;
    readonly supportedRuntimeIds: readonly RuntimeId[];
  };
  readonly platforms: readonly ("macos" | "windows")[];
  readonly architectures: readonly string[];
  readonly languages: readonly ("en" | "ru")[];
  readonly source: DownloadSource;
  readonly installStrategy: ModelInstallStrategy;
  readonly downloadUrl: string;
  readonly checksumSha256: string;
  readonly downloadSizeBytes: number;
  readonly diskSizeBytes: number;
  readonly estimatedMemoryBytes: number;
  readonly qualityLabel: ModelQualityLabel;
  readonly speedLabel: ModelSpeedLabel;
  readonly accuracyScore: number;
  readonly speedScore: number;
  readonly recommendedReason: string;
  readonly badges: readonly string[];
  readonly experimental: boolean;
  readonly devOnly?: boolean;
}

const gib = 1024 * 1024 * 1024;

export const bundledModelCatalog: readonly ModelCatalogEntry[] = [
  {
    id: "whisperkit-small",
    displayName: "WhisperKit Small",
    runtime: "whisperkit",
    runtimeRequirement: {
      engine: "whisperkit",
      supportedRuntimeIds: ["whisperkit"],
    },
    platforms: ["macos"],
    architectures: ["arm64"],
    languages: ["en", "ru"],
    source: {
      type: "huggingface-snapshot",
      repo: "argmaxinc/whisperkit-coreml",
      revision: "97a5bf9bbc74c7d9c12c755d04dea59e672e3808",
      subfolder: "openai_whisper-small",
    },
    installStrategy: {
      type: "huggingface-snapshot-directory",
      requiredFiles: [
        "AudioEncoder.mlmodelc/metadata.json",
        "MelSpectrogram.mlmodelc/metadata.json",
        "TextDecoder.mlmodelc/metadata.json",
      ],
    },
    downloadUrl:
      "https://huggingface.co/argmaxinc/whisperkit-coreml/tree/97a5bf9bbc74c7d9c12c755d04dea59e672e3808/openai_whisper-small",
    checksumSha256: "0000000000000000000000000000000000000000000000000000000000000001",
    downloadSizeBytes: Math.round(0.5 * gib),
    diskSizeBytes: Math.round(1.2 * gib),
    estimatedMemoryBytes: Math.round(1.8 * gib),
    qualityLabel: "balanced",
    speedLabel: "fast",
    accuracyScore: 72,
    speedScore: 78,
    recommendedReason: "Recommended for Apple Silicon because it balances latency and accuracy.",
    badges: ["recommended"],
    experimental: false,
  },
  {
    id: "whisper-cpp-small",
    displayName: "Whisper.cpp Small",
    runtime: "whisper-cpp",
    runtimeRequirement: {
      engine: "whisper-cpp",
      supportedRuntimeIds: ["whisper-cpp-windows-x64"],
    },
    platforms: ["windows"],
    architectures: ["x64", "arm64"],
    languages: ["en", "ru"],
    source: {
      type: "huggingface-file",
      repo: "ggerganov/whisper.cpp",
      revision: "5359861c739e955e79d9a303bcbc70fb988958b1",
      filePath: "ggml-small.bin",
    },
    installStrategy: {
      type: "single-file",
    },
    downloadUrl:
      "https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-small.bin",
    checksumSha256: "1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b",
    downloadSizeBytes: 487601967,
    diskSizeBytes: 487601967,
    estimatedMemoryBytes: 852 * 1024 * 1024,
    qualityLabel: "balanced",
    speedLabel: "fast",
    accuracyScore: 72,
    speedScore: 70,
    recommendedReason: "Recommended on Windows for a stable local-first baseline.",
    badges: ["recommended"],
    experimental: false,
  },
  {
    id: "parakeet-tdt-0-6b-v3",
    displayName: "Parakeet TDT 0.6B v3",
    runtime: "parakeet",
    runtimeRequirement: {
      engine: "parakeet",
      supportedRuntimeIds: [],
    },
    platforms: ["windows"],
    architectures: ["x64"],
    languages: ["en", "ru"],
    source: {
      type: "direct-url",
      url: "https://example.invalid/models/parakeet-tdt-0-6b-v3",
    },
    installStrategy: {
      type: "single-file",
    },
    downloadUrl: "https://example.invalid/models/parakeet-tdt-0-6b-v3",
    checksumSha256: "0000000000000000000000000000000000000000000000000000000000000003",
    downloadSizeBytes: Math.round(1.5 * gib),
    diskSizeBytes: Math.round(2.5 * gib),
    estimatedMemoryBytes: Math.round(3 * gib),
    qualityLabel: "quality",
    speedLabel: "moderate",
    accuracyScore: 82,
    speedScore: 50,
    recommendedReason: "Experimental option for users who prefer quality over speed.",
    badges: ["experimental"],
    experimental: true,
  },
];

export const bundledDevModelCatalog: readonly ModelCatalogEntry[] = [
  {
    id: "dev-smoke-model",
    displayName: "Dev Smoke Model",
    runtime: "whisper-cpp",
    runtimeRequirement: {
      engine: "whisper-cpp",
      supportedRuntimeIds: ["whisper-cpp-windows-x64", "whisper-cpp-macos-arm64"],
    },
    platforms: ["windows", "macos"],
    architectures: ["x64", "arm64"],
    languages: ["en", "ru"],
    source: {
      type: "local-file",
      relativePath: "dev-models/dev-smoke-model.bin",
    },
    installStrategy: {
      type: "single-file",
    },
    downloadUrl: "local-file://dev-models/dev-smoke-model.bin",
    checksumSha256: "e990a6df2e0b07318792697887c41705a2d238e7441eb5a2fd2fb5fd31e6e6b0",
    downloadSizeBytes: 512000,
    diskSizeBytes: 512000,
    estimatedMemoryBytes: 16 * 1024 * 1024,
    qualityLabel: "fast",
    speedLabel: "fastest",
    accuracyScore: 10,
    speedScore: 100,
    recommendedReason: "Development-only smoke model for installer tests.",
    badges: ["dev", "smoke"],
    experimental: true,
    devOnly: true,
  },
];

export const getBundledModelCatalog = ({
  includeDev,
}: {
  readonly includeDev: boolean;
}): readonly ModelCatalogEntry[] =>
  includeDev ? [...bundledModelCatalog, ...bundledDevModelCatalog] : bundledModelCatalog;

export const getCatalogModelDownloadUrl = (model: ModelCatalogEntry): string =>
  resolveDownloadSourceUrl(model.source);

export const findCatalogModel = (modelId: string): ModelCatalogEntry | undefined =>
  bundledModelCatalog.find((model) => model.id === modelId);
