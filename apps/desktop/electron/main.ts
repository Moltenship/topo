import { app, BrowserWindow } from "electron";
import { join } from "node:path";

const createMainWindow = (): BrowserWindow => {
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

  if (process.env.VITE_DEV_SERVER_URL) {
    void window.loadURL(process.env.VITE_DEV_SERVER_URL);
  }

  return window;
};

app.whenReady().then(() => {
  createMainWindow();
});
