import { contextBridge } from "electron";
import type { MoltenVoiceApi } from "@molten-voice/shared";

const api: MoltenVoiceApi = {
  appName: "Molten Voice",
};

contextBridge.exposeInMainWorld("moltenVoice", api);
