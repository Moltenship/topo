import { BrowserWindow } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = dirname(fileURLToPath(import.meta.url));

const loadRenderer = (window: BrowserWindow, hash?: string) => {
  const devServerUrl = process.env.ELECTRON_RENDERER_URL ?? process.env.VITE_DEV_SERVER_URL;

  if (devServerUrl) {
    const url = new URL(devServerUrl);

    if (hash) {
      url.hash = hash;
    }

    void window.loadURL(url.toString());
    return;
  }

  void window.loadFile(
    join(currentDirectory, "../renderer/index.html"),
    hash ? { hash } : undefined,
  );
};

export const createMainWindow = (): BrowserWindow => {
  const isMac = process.platform === "darwin";
  const window = new BrowserWindow({
    width: 1120,
    height: 760,
    frame: isMac,
    title: "Molten Voice",
    titleBarStyle: isMac ? "hiddenInset" : "hidden",
    ...(isMac ? { trafficLightPosition: { x: 14, y: 13 } } : {}),
    webPreferences: {
      preload: join(currentDirectory, "../preload/preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  loadRenderer(window);

  return window;
};

export const createOverlayWindow = (): BrowserWindow => {
  const window = new BrowserWindow({
    width: 496,
    height: 80,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    hasShadow: false,
    alwaysOnTop: true,
    focusable: false,
    skipTaskbar: true,
    resizable: false,
    webPreferences: {
      preload: join(currentDirectory, "../preload/preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  loadRenderer(window, "overlay");

  return window;
};
