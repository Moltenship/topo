import { clipboard, globalShortcut } from "electron";
import { spawn } from "node:child_process";
import { Effect } from "effect";
import type {
  ActiveApplicationSnapshot,
  NativeBridgeService,
  TextInsertionRequest,
  TextInsertionResult,
  Unsubscribe,
} from "@topo/native-bridge";
import type { NativeHotkeyEvent } from "@topo/shared";
import { insertTextWithWindowsAutomation } from "./windows-text-insertion";

const toElectronAccelerator = (hotkey: string): string =>
  hotkey
    .split("+")
    .map((part) => (part === "Ctrl" ? "CommandOrControl" : part === "CapsLock" ? "Capslock" : part))
    .join("+");

const repeatIdleMs = 800;

const runPowerShellCommand = (command: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-STA", "-ExecutionPolicy", "Bypass", "-Command", command],
      {
        windowsHide: true,
      },
    );
    let stderr = "";

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (exitCode) => {
      if (exitCode === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr.trim() || `PowerShell exited with ${exitCode ?? 1}`));
    });
  });

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
    insertText: (request: TextInsertionRequest): Effect.Effect<TextInsertionResult, Error> => {
      if (process.platform !== "win32") {
        return Effect.succeed({
          inserted: false,
          targetAppName: activeApplication.appName,
        });
      }

      return Effect.promise(async () => {
        await insertTextWithWindowsAutomation({
          clipboard,
          mode: request.mode,
          runCommand: runPowerShellCommand,
          text: request.text,
        });

        return {
          inserted: true,
          targetAppName: activeApplication.appName,
        };
      }).pipe(
        Effect.catchAll(() =>
          Effect.succeed({
            inserted: false,
            targetAppName: activeApplication.appName,
          } satisfies TextInsertionResult),
        ),
      );
    },
  };
};
