import type { DownloadSource } from "./download-source";

export type RuntimeId = "whisperkit" | "whisper-cpp-windows-x64" | "whisper-cpp-macos-arm64";
export type RuntimeEngine = "whisperkit" | "whisper-cpp";
export type RuntimePlatform = "macos" | "windows";
export type RuntimeArchitecture = "x64" | "arm64";

export interface RuntimeCatalogEntry {
  readonly id: RuntimeId;
  readonly displayName: string;
  readonly engine: RuntimeEngine;
  readonly platform: RuntimePlatform;
  readonly architecture: RuntimeArchitecture;
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
    id: "whisper-cpp-windows-x64",
    displayName: "Whisper.cpp Windows x64",
    engine: "whisper-cpp",
    platform: "windows",
    architecture: "x64",
    version: "1.8.2",
    source: {
      type: "direct-url",
      url: "https://example.invalid/runtimes/whisper-cpp-windows-x64.zip",
    },
    checksumSha256: null,
    downloadSizeBytes: 0,
    diskSizeBytes: 0,
    binaryRelativePath: "whisper-cli.exe",
    probeArgs: ["--help"],
  },
  {
    id: "whisper-cpp-macos-arm64",
    displayName: "Whisper.cpp macOS arm64",
    engine: "whisper-cpp",
    platform: "macos",
    architecture: "arm64",
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
