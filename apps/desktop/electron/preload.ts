import { contextBridge, ipcRenderer } from "electron";
import { IpcChannels } from "@molten-voice/shared";
import type { MoltenVoiceApi } from "@molten-voice/shared";

const api: MoltenVoiceApi = {
  appName: "Molten Voice",
  getAppState: () => ipcRenderer.invoke(IpcChannels.getAppState),
  listTranscripts: (query) => ipcRenderer.invoke(IpcChannels.listTranscripts, { query }),
  deleteTranscript: (id) => ipcRenderer.invoke(IpcChannels.deleteTranscript, { id }),
  clearTranscripts: () => ipcRenderer.invoke(IpcChannels.clearTranscripts),
  updateSettings: (settings) => ipcRenderer.invoke(IpcChannels.updateSettings, settings),
  startTestDictation: () => ipcRenderer.invoke(IpcChannels.startTestDictation),
  stopTestDictation: () => ipcRenderer.invoke(IpcChannels.stopTestDictation),
  onAppStateChanged: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, snapshot: unknown) => {
      listener(snapshot as Parameters<typeof listener>[0]);
    };

    ipcRenderer.on(IpcChannels.appStateChanged, handler);

    return () => {
      ipcRenderer.off(IpcChannels.appStateChanged, handler);
    };
  },
};

contextBridge.exposeInMainWorld("moltenVoice", api);
