export * from "./dictation";
export * from "./errors";
export * from "./installed-model";
export * from "./ipc";
export * from "./model-installation";

export type Platform = "linux" | "macos" | "windows";

import type { AppStateSnapshot } from "@molten-voice/contracts";
import type {
  AppSettings,
  InstalledModelRecord,
  ModelInstallProgress,
  OverlayPosition,
  TranscriptRecord,
} from "@molten-voice/contracts";
export { DEFAULT_APP_SETTINGS } from "@molten-voice/contracts";
export type {
  AppSettings,
  AppStateSnapshot,
  InstalledModelRecord,
  ModelInstallProgress,
  OverlayPosition,
  TranscriptRecord,
};

export interface MoltenVoiceApi {
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
  readonly cancelModelInstall: (modelId: string) => Promise<void>;
  readonly startTestDictation: () => Promise<void>;
  readonly stopTestDictation: (input: {
    readonly wavBytes: Uint8Array;
    readonly durationMs: number;
  }) => Promise<TranscriptRecord>;
  readonly minimizeWindow: () => Promise<void>;
  readonly toggleMaximizeWindow: () => Promise<void>;
  readonly closeWindow: () => Promise<void>;
  readonly onAppStateChanged: (listener: (snapshot: AppStateSnapshot) => void) => () => void;
}

export const APP_NAME = "Molten Voice";
