export * from "./dictation";
export * from "./errors";
export * from "./ipc";

export type Platform = "macos" | "windows";

export interface MoltenVoiceApi {
  readonly appName: string;
}

export const APP_NAME = "Molten Voice";
