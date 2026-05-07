export * from "./dictation";
export * from "./errors";
export * from "./ipc";

export type Platform = "macos" | "windows";

export interface AppStateSnapshot {
  readonly setupComplete: boolean;
  readonly overlayState: import("./dictation").OverlayState;
}

export interface MoltenVoiceApi {
  readonly appName: string;
  readonly getAppState: () => Promise<AppStateSnapshot>;
}

export const APP_NAME = "Molten Voice";
