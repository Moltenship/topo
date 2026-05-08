import { BrowserWindow } from "electron";
import { join } from "node:path";

const loadRenderer = (window: BrowserWindow, hash?: string) => {
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;

  if (devServerUrl) {
    const url = new URL(devServerUrl);

    if (hash) {
      url.hash = hash;
    }

    void window.loadURL(url.toString());
    return;
  }

  void window.loadFile(join(__dirname, "../renderer/index.html"), hash ? { hash } : undefined);
};

export const createMainWindow = (): BrowserWindow => {
  const window = new BrowserWindow({
    width: 1120,
    height: 760,
    title: "Molten Voice",
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  loadRenderer(window);

  return window;
};

export const createOverlayWindow = (): BrowserWindow => {
  const window = new BrowserWindow({
    width: 520,
    height: 96,
    show: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    focusable: false,
    skipTaskbar: true,
    resizable: false,
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  loadRenderer(window, "overlay");

  return window;
};
