import type { DownloadSource } from "./download-source";

export type RuntimeId =
  | "whisperkit"
  | "whisper-cpp-windows-x64-cpu"
  | "whisper-cpp-windows-x64-cuda"
  | "whisper-cpp-macos-arm64";
export type RuntimeEngine = "whisperkit" | "whisper-cpp";
export type RuntimePlatform = "macos" | "windows";
export type RuntimeArchitecture = "x64" | "arm64";
export type RuntimeAccelerator = "system" | "cpu" | "cuda" | "metal";

export interface RuntimeCatalogEntry {
  readonly id: RuntimeId;
  readonly displayName: string;
  readonly engine: RuntimeEngine;
  readonly platform: RuntimePlatform;
  readonly architecture: RuntimeArchitecture;
  readonly accelerator: RuntimeAccelerator;
  readonly version: string;
  readonly source: DownloadSource | { readonly type: "system"; readonly description: string };
  readonly checksumSha256: string | null;
  readonly downloadSizeBytes: number;
  readonly diskSizeBytes: number;
  readonly binaryRelativePath: string | null;
  readonly probeArgs: readonly string[];
}

export const bundledRuntimeCatalog: readonly RuntimeCatalogEntry[] = [
  {
    id: "whisperkit",
    displayName: "WhisperKit",
    engine: "whisperkit",
    platform: "macos",
    architecture: "arm64",
    accelerator: "system",
    version: "system",
    source: {
      type: "system",
      description: "WhisperKit runs as an on-device Apple Silicon runtime.",
    },
    checksumSha256: null,
    downloadSizeBytes: 0,
    diskSizeBytes: 0,
    binaryRelativePath: null,
    probeArgs: [],
  },
  {
    id: "whisper-cpp-windows-x64-cpu",
    displayName: "Whisper.cpp Windows x64 CPU",
    engine: "whisper-cpp",
    platform: "windows",
    architecture: "x64",
    accelerator: "cpu",
    version: "1.8.4",
    source: {
      type: "direct-url",
      url: "https://github.com/ggml-org/whisper.cpp/releases/download/v1.8.4/whisper-bin-x64.zip",
    },
    checksumSha256: "74f973345cb52ef5ba3ec9e7e7af8e48cc8c71722d1528603b80588a11f82e3e",
    downloadSizeBytes: 4_078_768,
    diskSizeBytes: 16 * 1024 * 1024,
    binaryRelativePath: "Release/whisper-cli.exe",
    probeArgs: ["--help"],
  },
  {
    id: "whisper-cpp-windows-x64-cuda",
    displayName: "Whisper.cpp Windows x64 CUDA",
    engine: "whisper-cpp",
    platform: "windows",
    architecture: "x64",
    accelerator: "cuda",
    version: "1.8.4",
    source: {
      type: "direct-url",
      url: "https://github.com/ggml-org/whisper.cpp/releases/download/v1.8.4/whisper-cublas-12.4.0-bin-x64.zip",
    },
    checksumSha256: "b07cff4e59831b227896018facbb6334907bf324a342c84597c44f087823d252",
    downloadSizeBytes: 457_024_596,
    diskSizeBytes: 512 * 1024 * 1024,
    binaryRelativePath: "Release/whisper-cli.exe",
    probeArgs: ["--help"],
  },
  {
    id: "whisper-cpp-macos-arm64",
    displayName: "Whisper.cpp macOS arm64",
    engine: "whisper-cpp",
    platform: "macos",
    architecture: "arm64",
    accelerator: "metal",
    version: "1.8.2",
    source: {
      type: "direct-url",
      url: "https://example.invalid/runtimes/whisper-cpp-macos-arm64.zip",
    },
    checksumSha256: null,
    downloadSizeBytes: 0,
    diskSizeBytes: 0,
    binaryRelativePath: "whisper-cli",
    probeArgs: ["--help"],
  },
];

export const findCatalogRuntime = (runtimeId: RuntimeId): RuntimeCatalogEntry | undefined =>
  bundledRuntimeCatalog.find((runtime) => runtime.id === runtimeId);
