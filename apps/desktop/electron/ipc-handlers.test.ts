import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IpcChannels, DEFAULT_APP_SETTINGS } from "@topo/shared";
import { registerIpcHandlers } from "./ipc-handlers";

const handlers = new Map<string, (event: unknown, input: unknown) => unknown>();

vi.mock("electron", () => ({
  BrowserWindow: {
    fromWebContents: vi.fn(),
    getAllWindows: vi.fn(() => []),
  },
  clipboard: {
    writeText: vi.fn(),
  },
  ipcMain: {
    handle: vi.fn((channel: string, handler: (event: unknown, input: unknown) => unknown) => {
      handlers.set(channel, handler);
    }),
  },
}));

const createDependencies = () => ({
  database: {
    settings: {
      get: () => Effect.succeed(DEFAULT_APP_SETTINGS),
      set: (settings: typeof DEFAULT_APP_SETTINGS) => Effect.succeed(settings),
    },
    transcripts: {
      insert: () => Effect.void,
      getById: () => Effect.succeed(null),
      list: () => Effect.succeed([]),
      deleteById: () => Effect.void,
      deleteCreatedBefore: () => Effect.void,
      clear: () => Effect.void,
    },
    installedModels: {
      upsert: <T>(record: T) => Effect.succeed(record),
      getByModelId: () => Effect.succeed(null),
      list: () => Effect.succeed([]),
      removeByModelId: () => Effect.void,
    },
    installedRuntimes: {
      upsert: <T>(record: T) => Effect.succeed(record),
      getByRuntimeId: () => Effect.succeed(null),
      list: () => Effect.succeed([]),
      removeByRuntimeId: () => Effect.void,
    },
    close: () => Effect.void,
    path: ":memory:",
  },
  dictation: {
    start: () => Effect.succeed("session_1"),
    stop: () => Effect.fail(new Error("not implemented")),
  },
  modelInstallJob: {
    start: () => Effect.fail(new Error("not implemented")),
    cancel: () => Effect.void,
    getCurrentProgress: () => null,
    getInstalledModelPath: () => null,
  },
  runtimeInstallJob: {
    start: () => Effect.fail(new Error("not implemented")),
    cancel: () => Effect.void,
    getCurrentProgress: () => null,
    getInstalledRuntimePath: () => null,
  },
  nativeBridge: {
    supportsHotkeyReleaseEvents: true,
    insertText: () => Effect.succeed({ inserted: true, targetAppName: null }),
    registerHotkey: () => Effect.succeed(() => {}),
    getActiveApplication: () => Effect.succeed({ appName: null, windowTitle: null }),
  },
});

describe("registerIpcHandlers", () => {
  beforeEach(() => {
    handlers.clear();
  });

  it("registers a temporary load transcript audio handler", async () => {
    registerIpcHandlers(createDependencies());

    await expect(
      handlers.get(IpcChannels.loadTranscriptAudio)?.(null, { id: "tr_1" }),
    ).rejects.toThrow(
      "Transcript audio loading is not available until transcript audio storage is initialized.",
    );
  });
});
