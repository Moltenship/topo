import { BrowserWindow } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const titleBarHeight = 40;
const titleBarOverlayColor = "#01000000";
const titleBarOverlaySymbolColor = "#f8fafc";

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
    title: "Topo",
    titleBarStyle: isMac ? "hiddenInset" : "hidden",
    ...(isMac ? { trafficLightPosition: { x: 16, y: 18 } } : {}),
    ...(!isMac
      ? {
          titleBarOverlay: {
            color: titleBarOverlayColor,
            height: titleBarHeight,
            symbolColor: titleBarOverlaySymbolColor,
          },
        }
      : {}),
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
    width: OVERLAY_WINDOW_SIZE.width,
    height: OVERLAY_WINDOW_SIZE.height,
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
import { OVERLAY_WINDOW_SIZE } from "./overlay-position";
