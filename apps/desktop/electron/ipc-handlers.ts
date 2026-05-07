import { ipcMain } from "electron";
import { Effect } from "effect";
import type { AppStateSnapshot } from "@molten-voice/shared";
import { IpcChannels } from "@molten-voice/shared";

const getAppState = (): Effect.Effect<AppStateSnapshot> =>
  Effect.succeed({
    setupComplete: false,
    overlayState: "hidden",
  });

export const registerIpcHandlers = () => {
  ipcMain.handle(IpcChannels.getAppState, () => Effect.runPromise(getAppState()));
};
