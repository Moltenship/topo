import { contextBridge, ipcRenderer } from "electron";
import { IpcChannels } from "@molten-voice/shared";
import type { MoltenVoiceApi, Platform } from "@molten-voice/shared";

const platform: Platform =
  process.platform === "darwin" ? "macos" : process.platform === "win32" ? "windows" : "linux";

const api: MoltenVoiceApi = {
  appName: "Molten Voice",
  platform,
  getAppState: () => ipcRenderer.invoke(IpcChannels.getAppState),
  listTranscripts: (query) => ipcRenderer.invoke(IpcChannels.listTranscripts, { query }),
  copyTranscript: (id) => ipcRenderer.invoke(IpcChannels.copyTranscript, { id }),
  reinsertTranscript: (id) => ipcRenderer.invoke(IpcChannels.reinsertTranscript, { id }),
  deleteTranscript: (id) => ipcRenderer.invoke(IpcChannels.deleteTranscript, { id }),
  clearTranscripts: () => ipcRenderer.invoke(IpcChannels.clearTranscripts),
  updateSettings: (settings) => ipcRenderer.invoke(IpcChannels.updateSettings, settings),
  showOverlayPreview: () => ipcRenderer.invoke(IpcChannels.showOverlayPreview),
  commitOverlayPreviewPosition: (input) =>
    ipcRenderer.invoke(IpcChannels.commitOverlayPreviewPosition, input),
  installModel: (modelId) => ipcRenderer.invoke(IpcChannels.installModel, { modelId }),
  cancelModelInstall: (modelId) => ipcRenderer.invoke(IpcChannels.cancelModelInstall, { modelId }),
  startTestDictation: () => ipcRenderer.invoke(IpcChannels.startTestDictation),
  stopTestDictation: (input) => ipcRenderer.invoke(IpcChannels.stopTestDictation, input),
  minimizeWindow: () => ipcRenderer.invoke(IpcChannels.windowMinimize),
  toggleMaximizeWindow: () => ipcRenderer.invoke(IpcChannels.windowMaximize),
  closeWindow: () => ipcRenderer.invoke(IpcChannels.windowClose),
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
