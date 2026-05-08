import { Effect } from "effect";
import type { InsertionMode } from "@molten-voice/shared";

export type NativeHotkeyPhase = "down" | "up";

export interface NativeHotkeyEvent {
  readonly hotkey: string;
  readonly phase: NativeHotkeyPhase;
  readonly timestampMs: number;
}

export interface ActiveApplicationSnapshot {
  readonly appName: string | null;
  readonly windowTitle: string | null;
}

export interface TextInsertionRequest {
  readonly text: string;
  readonly mode: InsertionMode;
}

export interface TextInsertionResult {
  readonly inserted: boolean;
  readonly targetAppName: string | null;
}

export type Unsubscribe = () => void;

export interface NativeBridgeService {
  readonly registerHotkey: (
    hotkey: string,
    listener: (event: NativeHotkeyEvent) => void,
  ) => Effect.Effect<Unsubscribe, Error>;
  readonly getActiveApplication: () => Effect.Effect<ActiveApplicationSnapshot, Error>;
  readonly insertText: (request: TextInsertionRequest) => Effect.Effect<TextInsertionResult, Error>;
}

interface MockNativeBridgeOptions {
  readonly now?: () => number;
  readonly activeApplication?: ActiveApplicationSnapshot;
}

export interface MockNativeBridgeService extends NativeBridgeService {
  readonly emitHotkeyDown: (hotkey: string) => Effect.Effect<void>;
  readonly emitHotkeyUp: (hotkey: string) => Effect.Effect<void>;
  readonly insertedTexts: readonly TextInsertionRequest[];
}

export const createMockNativeBridgeService = (
  options: MockNativeBridgeOptions = {},
): MockNativeBridgeService => {
  const now = options.now ?? Date.now;
  const activeApplication = options.activeApplication ?? {
    appName: "Mock editor",
    windowTitle: "Untitled",
  };
  const listeners = new Map<string, Set<(event: NativeHotkeyEvent) => void>>();
  const insertedTexts: TextInsertionRequest[] = [];

  const emit = (hotkey: string, phase: NativeHotkeyPhase) =>
    Effect.sync(() => {
      const hotkeyListeners = listeners.get(hotkey);

      if (!hotkeyListeners) {
        return;
      }

      for (const listener of hotkeyListeners) {
        listener({ hotkey, phase, timestampMs: now() });
      }
    });

  return {
    registerHotkey: (hotkey, listener) =>
      Effect.sync(() => {
        const hotkeyListeners =
          listeners.get(hotkey) ?? new Set<(event: NativeHotkeyEvent) => void>();

        hotkeyListeners.add(listener);
        listeners.set(hotkey, hotkeyListeners);

        return () => {
          hotkeyListeners.delete(listener);

          if (hotkeyListeners.size === 0) {
            listeners.delete(hotkey);
          }
        };
      }),
    getActiveApplication: () => Effect.succeed(activeApplication),
    insertText: (request) =>
      Effect.sync(() => {
        insertedTexts.push(request);

        return {
          inserted: true,
          targetAppName: activeApplication.appName,
        };
      }),
    emitHotkeyDown: (hotkey) => emit(hotkey, "down"),
    emitHotkeyUp: (hotkey) => emit(hotkey, "up"),
    insertedTexts,
  };
};
