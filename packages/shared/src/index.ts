export * from "./dictation";
export * from "./dictation-readiness";
export * from "./errors";
export { formatHotkey, normalizeHotkeyFromKeys } from "@topo/contracts";
export * from "./installed-model";
export * from "./ipc";
export * from "./model-installation";
export type {
  ApiPostProcessingProvider,
  ApiPostProcessingSettings,
  PostProcessingMode,
  PostProcessingProviderId,
  PostProcessingRequest,
  PostProcessingTargetSchema,
} from "@topo/contracts";
export type { InstalledRuntimeRecord } from "@topo/contracts";

export type Platform = "linux" | "macos" | "windows";

import type { AppStateSnapshot } from "@topo/contracts";
import type {
  AppSettings,
  InstalledModelRecord,
  InstallBundleProgress,
  ModelInstallProgress,
  NativeHotkeyEvent,
  NativeHotkeyPhase,
  OverlayPosition,
  TranscriptRecord,
} from "@topo/contracts";
export { DEFAULT_APP_SETTINGS } from "@topo/contracts";
export type {
  AppSettings,
  AppStateSnapshot,
  InstalledModelRecord,
  InstallBundleProgress,
  ModelInstallProgress,
  NativeHotkeyEvent,
  NativeHotkeyPhase,
  OverlayPosition,
  TranscriptRecord,
};

export interface TopoApi {
  readonly appName: string;
  readonly platform: Platform;
  readonly getAppState: () => Promise<AppStateSnapshot>;
  readonly listTranscripts: (query?: string) => Promise<readonly TranscriptRecord[]>;
  readonly copyTranscript: (id: string) => Promise<void>;
  readonly reinsertTranscript: (id: string) => Promise<void>;
  readonly deleteTranscript: (id: string) => Promise<void>;
  readonly clearTranscripts: () => Promise<void>;
  readonly updateSettings: (settings: AppSettings) => Promise<AppSettings>;
  readonly showOverlayPreview: () => Promise<void>;
  readonly commitOverlayPreviewPosition: (input: {
    readonly centerX: number;
    readonly centerY: number;
  }) => Promise<void>;
  readonly installModel: (modelId: string) => Promise<ModelInstallProgress>;
  readonly installModelBundle: (modelId: string) => Promise<InstallBundleProgress>;
  readonly cancelModelInstall: (modelId: string) => Promise<void>;
  readonly refreshModelReadiness: () => Promise<void>;
  readonly startTestDictation: () => Promise<void>;
  readonly stopTestDictation: (input: {
    readonly wavBytes: Uint8Array;
    readonly durationMs: number;
  }) => Promise<TranscriptRecord>;
  readonly minimizeWindow: () => Promise<void>;
  readonly toggleMaximizeWindow: () => Promise<void>;
  readonly closeWindow: () => Promise<void>;
  readonly onAppStateChanged: (listener: (snapshot: AppStateSnapshot) => void) => () => void;
  readonly onGlobalHotkeyEvent: (listener: (event: NativeHotkeyEvent) => void) => () => void;
}

export const APP_NAME = "Topo";
