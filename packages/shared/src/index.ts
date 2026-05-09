export * from "./dictation";
export * from "./errors";
export * from "./installed-model";
export * from "./ipc";
export * from "./model-installation";

export type Platform = "macos" | "windows";

import type { AppStateSnapshot } from "@molten-voice/contracts";
import type {
  AppSettings,
  InstalledModelRecord,
  ModelInstallProgress,
  TranscriptRecord,
} from "@molten-voice/contracts";
export { DEFAULT_APP_SETTINGS } from "@molten-voice/contracts";
export type {
  AppSettings,
  AppStateSnapshot,
  InstalledModelRecord,
  ModelInstallProgress,
  TranscriptRecord,
};

export interface MoltenVoiceApi {
  readonly appName: string;
  readonly getAppState: () => Promise<AppStateSnapshot>;
  readonly listTranscripts: (query?: string) => Promise<readonly TranscriptRecord[]>;
  readonly deleteTranscript: (id: string) => Promise<void>;
  readonly clearTranscripts: () => Promise<void>;
  readonly updateSettings: (settings: AppSettings) => Promise<AppSettings>;
  readonly installModel: (modelId: string) => Promise<ModelInstallProgress>;
  readonly cancelModelInstall: (modelId: string) => Promise<void>;
  readonly startTestDictation: () => Promise<void>;
  readonly stopTestDictation: () => Promise<TranscriptRecord>;
  readonly onAppStateChanged: (listener: (snapshot: AppStateSnapshot) => void) => () => void;
}

export const APP_NAME = "Molten Voice";
