export * from "./dictation";
export * from "./errors";
export * from "./ipc";

export type Platform = "macos" | "windows";

import type { AppStateSnapshot } from "@molten-voice/contracts";
import type { AppSettings, TranscriptRecord } from "@molten-voice/contracts";
export { DEFAULT_APP_SETTINGS } from "@molten-voice/contracts";
export type { AppSettings, AppStateSnapshot, TranscriptRecord };

export interface MoltenVoiceApi {
  readonly appName: string;
  readonly getAppState: () => Promise<AppStateSnapshot>;
  readonly listTranscripts: (query?: string) => Promise<readonly TranscriptRecord[]>;
  readonly deleteTranscript: (id: string) => Promise<void>;
  readonly clearTranscripts: () => Promise<void>;
  readonly updateSettings: (settings: AppSettings) => Promise<AppSettings>;
  readonly startTestDictation: () => Promise<void>;
  readonly stopTestDictation: () => Promise<TranscriptRecord>;
}

export const APP_NAME = "Molten Voice";
