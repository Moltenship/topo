import { contextBridge, ipcRenderer } from "electron";
import { IpcChannels } from "@molten-voice/shared";
import type { MoltenVoiceApi } from "@molten-voice/shared";

const api: MoltenVoiceApi = {
  appName: "Molten Voice",
  getAppState: () => ipcRenderer.invoke(IpcChannels.getAppState),
};

contextBridge.exposeInMainWorld("moltenVoice", api);
