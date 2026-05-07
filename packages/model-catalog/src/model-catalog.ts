export type AsrRuntime = "whisperkit" | "whisper-cpp" | "parakeet";
export type ModelQualityLabel = "fast" | "balanced" | "quality";
export type ModelSpeedLabel = "fastest" | "fast" | "moderate";

export interface ModelCatalogEntry {
  readonly id: string;
  readonly displayName: string;
  readonly runtime: AsrRuntime;
  readonly platforms: readonly ("macos" | "windows")[];
  readonly architectures: readonly string[];
  readonly languages: readonly ("en" | "ru")[];
  readonly downloadUrl: string;
  readonly checksumSha256: string;
  readonly downloadSizeBytes: number;
  readonly diskSizeBytes: number;
  readonly estimatedMemoryBytes: number;
  readonly qualityLabel: ModelQualityLabel;
  readonly speedLabel: ModelSpeedLabel;
  readonly badges: readonly string[];
  readonly experimental: boolean;
}

const gib = 1024 * 1024 * 1024;

export const bundledModelCatalog: readonly ModelCatalogEntry[] = [
  {
    id: "whisperkit-small",
    displayName: "WhisperKit Small",
    runtime: "whisperkit",
    platforms: ["macos"],
    architectures: ["arm64"],
    languages: ["en", "ru"],
    downloadUrl: "https://example.invalid/models/whisperkit-small",
    checksumSha256: "0000000000000000000000000000000000000000000000000000000000000001",
    downloadSizeBytes: Math.round(0.5 * gib),
    diskSizeBytes: Math.round(1.2 * gib),
    estimatedMemoryBytes: Math.round(1.8 * gib),
    qualityLabel: "balanced",
    speedLabel: "fast",
    badges: ["recommended"],
    experimental: false,
  },
  {
    id: "whisper-cpp-small",
    displayName: "Whisper.cpp Small",
    runtime: "whisper-cpp",
    platforms: ["windows"],
    architectures: ["x64", "arm64"],
    languages: ["en", "ru"],
    downloadUrl: "https://example.invalid/models/whisper-cpp-small",
    checksumSha256: "0000000000000000000000000000000000000000000000000000000000000002",
    downloadSizeBytes: Math.round(0.5 * gib),
    diskSizeBytes: Math.round(1.1 * gib),
    estimatedMemoryBytes: Math.round(1.8 * gib),
    qualityLabel: "balanced",
    speedLabel: "fast",
    badges: ["recommended"],
    experimental: false,
  },
  {
    id: "parakeet-tdt-0-6b-v3",
    displayName: "Parakeet TDT 0.6B v3",
    runtime: "parakeet",
    platforms: ["windows"],
    architectures: ["x64"],
    languages: ["en", "ru"],
    downloadUrl: "https://example.invalid/models/parakeet-tdt-0-6b-v3",
    checksumSha256: "0000000000000000000000000000000000000000000000000000000000000003",
    downloadSizeBytes: Math.round(1.5 * gib),
    diskSizeBytes: Math.round(2.5 * gib),
    estimatedMemoryBytes: Math.round(3 * gib),
    qualityLabel: "quality",
    speedLabel: "moderate",
    badges: ["experimental"],
    experimental: true,
  },
];

export const findCatalogModel = (modelId: string): ModelCatalogEntry | undefined =>
  bundledModelCatalog.find((model) => model.id === modelId);
