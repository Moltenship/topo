import type { MoltenVoiceApi } from "@molten-voice/shared";

declare global {
  interface Window {
    moltenVoice: MoltenVoiceApi;
  }
}

export {};
