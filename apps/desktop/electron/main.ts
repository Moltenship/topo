import { app } from "electron";
import { registerIpcHandlers } from "./ipc-handlers";
import { createMainWindow } from "./window-manager";

app.whenReady().then(() => {
  registerIpcHandlers();
  createMainWindow();
});
