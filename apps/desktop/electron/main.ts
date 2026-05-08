import { app } from "electron";
import { Effect } from "effect";
import { openAppDatabase } from "@molten-voice/db";
import { registerIpcHandlers } from "./ipc-handlers";
import { createMainWindow } from "./window-manager";

app.whenReady().then(() => {
  const database = Effect.runSync(openAppDatabase(app.getPath("userData")));

  registerIpcHandlers({ database });
  createMainWindow();
});
