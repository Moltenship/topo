import { contextBridge, ipcRenderer } from "electron";
import { IpcChannels } from "@topo/shared";
import type { TopoApi, Platform } from "@topo/shared";

const platform: Platform =
  process.platform === "darwin" ? "macos" : process.platform === "win32" ? "windows" : "linux";

const api: TopoApi = {
  appName: "Topo",
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
  installModelBundle: (modelId) => ipcRenderer.invoke(IpcChannels.installModelBundle, { modelId }),
  cancelModelInstall: (modelId) => ipcRenderer.invoke(IpcChannels.cancelModelInstall, { modelId }),
  refreshModelReadiness: () => ipcRenderer.invoke(IpcChannels.refreshModelReadiness),
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
  onGlobalHotkeyEvent: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: unknown) => {
      listener(payload as Parameters<typeof listener>[0]);
    };

    ipcRenderer.on(IpcChannels.globalHotkeyEvent, handler);

    return () => {
      ipcRenderer.off(IpcChannels.globalHotkeyEvent, handler);
    };
  },
};

contextBridge.exposeInMainWorld("topo", api);
