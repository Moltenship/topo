export * from "./dictation";
export * from "./errors";
export * from "./ipc";

export type Platform = "macos" | "windows";

import type { AppStateSnapshot } from "@molten-voice/contracts";
export type { AppStateSnapshot };

export interface MoltenVoiceApi {
  readonly appName: string;
  readonly getAppState: () => Promise<AppStateSnapshot>;
}

export const APP_NAME = "Molten Voice";
