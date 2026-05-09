import { globalShortcut } from "electron";
import { Effect } from "effect";
import type {
  ActiveApplicationSnapshot,
  NativeBridgeService,
  TextInsertionRequest,
  TextInsertionResult,
  Unsubscribe,
} from "@molten-voice/native-bridge";
import type { NativeHotkeyEvent } from "@molten-voice/shared";

const toElectronAccelerator = (hotkey: string): string =>
  hotkey
    .split("+")
    .map((part) => (part === "Ctrl" ? "CommandOrControl" : part === "CapsLock" ? "Capslock" : part))
    .join("+");

const repeatIdleMs = 800;

export const createElectronHotkeyBridge = (): NativeBridgeService => {
  const activeApplication: ActiveApplicationSnapshot = {
    appName: null,
    windowTitle: null,
  };

  return {
    registerHotkey: (hotkey, listener) =>
      Effect.try({
        try: (): Unsubscribe => {
          const accelerator = toElectronAccelerator(hotkey);
          let active = false;
          let lastEventAt = 0;
          const registered = globalShortcut.register(accelerator, () => {
            const now = Date.now();

            if (active && now - lastEventAt < repeatIdleMs) {
              lastEventAt = now;
              return;
            }

            lastEventAt = now;
            active = !active;
            const event: NativeHotkeyEvent = {
              hotkey,
              phase: active ? "down" : "up",
              timestampMs: now,
            };

            listener(event);
          });

          if (!registered) {
            throw new Error(`Unable to register global hotkey: ${hotkey}`);
          }

          return () => globalShortcut.unregister(accelerator);
        },
        catch: (error) => (error instanceof Error ? error : new Error(String(error))),
      }),
    getActiveApplication: () => Effect.succeed(activeApplication),
    insertText: (_request: TextInsertionRequest): Effect.Effect<TextInsertionResult, Error> =>
      Effect.succeed({
        inserted: true,
        targetAppName: activeApplication.appName,
      }),
  };
};
