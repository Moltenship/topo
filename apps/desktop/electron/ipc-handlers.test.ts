import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { bundledModelCatalog } from "@topo/model-catalog";
import {
  IpcChannels,
  DEFAULT_APP_SETTINGS,
  type AppSettings,
  type TranscriptRecord,
} from "@topo/shared";
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

const readyModel = bundledModelCatalog.find((model) => model.id === "whisper-cpp-small")!;
const readyWhisperKitModel = bundledModelCatalog.find((model) => model.id === "whisperkit-small")!;
const readySettings: AppSettings = {
  ...DEFAULT_APP_SETTINGS,
  activeModelId: readyModel.id,
};
const transcript: TranscriptRecord = {
  id: "tr_audio",
  text: "hello",
  createdAt: "2026-05-15T00:00:00.000Z",
  durationMs: 1200,
  modelId: readyModel.id,
  runtime: readyModel.runtime,
  language: "en",
  recordingMode: "toggle-to-talk",
  stopReason: "hotkey-release",
  insertionMode: "paste",
  insertionStatus: "skipped",
  targetAppName: null,
  audioFileName: null,
  audioMimeType: null,
  audioByteSize: null,
};
const createInstalledModel = (model: typeof readyModel) => ({
  id: "installed_whisper-cpp-small",
  modelId: model.id,
  runtime: model.runtime,
  sourceType: "huggingface-file",
  sourceRevision: "test",
  installedPath: "/models/ggml-small.bin",
  checksumSha256: "checksum",
  verificationStatus: "verified" as const,
  installedAt: "2026-05-15T00:00:00.000Z",
});
const capturedAudioPath = "/tmp/topo-capture.wav";

const invoke = <T>(channel: string, input?: unknown): Promise<T> => {
  const handler = handlers.get(channel);

  if (!handler) {
    throw new Error(`No handler registered for ${channel}`);
  }

  return handler({ sender: {} }, input) as Promise<T>;
};

const createDependencies = (overrides: Record<string, unknown> = {}) => ({
  database: {
    settings: {
      get: () => Effect.succeed(DEFAULT_APP_SETTINGS),
      set: (settings: typeof DEFAULT_APP_SETTINGS) => Effect.succeed(settings),
    },
    transcripts: {
      insert: () => Effect.void,
      getById: () => Effect.succeed(null),
      getAudioFileNameById: () => Effect.succeed(null),
      getAudioFileNamesCreatedBefore: () => Effect.succeed([]),
      listAudioFileNames: () => Effect.succeed([]),
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
  ...overrides,
});

const createReadyDependencies = (
  settings: AppSettings,
  overrides: Record<string, unknown> = {},
  transcriptOverride: Partial<TranscriptRecord> = {},
  selectedModel = readyModel,
  options: {
    readonly insertTranscript?: (record: TranscriptRecord) => Effect.Effect<void, Error>;
    readonly transcriptAudioStore?: {
      readonly saveWavForTranscript: (input: {
        readonly transcriptId: string;
        readonly sourcePath: string;
      }) => Effect.Effect<
        {
          readonly audioFileName: string;
          readonly audioMimeType: "audio/wav";
          readonly audioByteSize: number;
        },
        Error
      >;
      readonly loadByFileName: (fileName: string) => Effect.Effect<{
        readonly bytes: Uint8Array;
        readonly mimeType: "audio/wav";
        readonly byteSize: number;
      }>;
      readonly listFileNames: () => Effect.Effect<readonly string[], Error>;
      readonly deleteByFileNames: (fileNames: readonly string[]) => Effect.Effect<void, Error>;
    };
  } = {},
) => {
  let insertedTranscript: TranscriptRecord | null = null;
  let savedInput: { readonly transcriptId: string; readonly sourcePath: string } | null = null;
  const installedModel = createInstalledModel(selectedModel);
  const transcriptAudioStore = options.transcriptAudioStore ?? {
    saveWavForTranscript: (input: { readonly transcriptId: string; readonly sourcePath: string }) =>
      Effect.sync(() => {
        savedInput = input;
        return {
          audioFileName: `${input.transcriptId}.wav`,
          audioMimeType: "audio/wav" as const,
          audioByteSize: 4,
        };
      }),
    loadByFileName: () =>
      Effect.succeed({
        bytes: new Uint8Array([1, 2, 3, 4]),
        mimeType: "audio/wav" as const,
        byteSize: 4,
      }),
    listFileNames: () => Effect.succeed([]),
    deleteByFileNames: () => Effect.void,
  };
  const dependencies = createDependencies({
    database: {
      ...createDependencies().database,
      settings: {
        get: () => Effect.succeed(settings),
        set: (nextSettings: typeof DEFAULT_APP_SETTINGS) => Effect.succeed(nextSettings),
      },
      transcripts: {
        ...createDependencies().database.transcripts,
        insert:
          options.insertTranscript ??
          ((record: TranscriptRecord) =>
            Effect.sync(() => {
              insertedTranscript = record;
            })),
      },
      installedModels: {
        ...createDependencies().database.installedModels,
        getByModelId: () => Effect.succeed(installedModel),
        list: () => Effect.succeed([installedModel]),
      },
      installedRuntimes: createDependencies().database.installedRuntimes,
      close: () => Effect.void,
      path: ":memory:",
    },
    dictation: {
      start: () => Effect.succeed("session_1"),
      stop: (input: {
        readonly preserveCapturedAudio?: (preserveInput: {
          readonly transcriptId: string;
          readonly audioPath: string;
        }) => Effect.Effect<
          {
            readonly audioFileName: string;
            readonly audioMimeType: string;
            readonly audioByteSize: number;
          },
          Error
        >;
        readonly shouldPreserveCapturedAudio?: (preserveInput: {
          readonly text: string;
        }) => boolean;
        readonly onPreserveCapturedAudioError?: (error: Error) => Effect.Effect<void>;
      }) =>
        Effect.gen(function* () {
          const nextTranscript = {
            ...transcript,
            ...transcriptOverride,
          };
          const shouldPreserveAudio =
            input.shouldPreserveCapturedAudio?.({ text: nextTranscript.text }) ?? true;
          const audioMetadata =
            input.preserveCapturedAudio && shouldPreserveAudio
              ? yield* input
                  .preserveCapturedAudio({
                    transcriptId: nextTranscript.id,
                    audioPath: capturedAudioPath,
                  })
                  .pipe(
                    Effect.catchAll((error) =>
                      (input.onPreserveCapturedAudioError?.(error) ?? Effect.void).pipe(
                        Effect.catchAll(() => Effect.void),
                        Effect.as(null),
                      ),
                    ),
                  )
              : null;

          return {
            ...nextTranscript,
            audioFileName: audioMetadata?.audioFileName ?? null,
            audioMimeType: audioMetadata?.audioMimeType ?? null,
            audioByteSize: audioMetadata?.audioByteSize ?? null,
          };
        }),
    },
    catalog: [selectedModel],
    whisperCppRuntimeResolver: {
      resolve: () =>
        Effect.succeed({
          status: "available" as const,
          binaryPath: "/bin/whisper-cli",
          checkedAt: "2026-05-15T00:00:00.000Z",
        }),
    },
    transcriptAudioStore,
    ...overrides,
  });

  return {
    dependencies,
    getInsertedTranscript: () => insertedTranscript,
    getSavedInput: () => savedInput,
  };
};

describe("registerIpcHandlers", () => {
  beforeEach(() => {
    handlers.clear();
  });

  it("saves transcript audio metadata during settings test dictation when enabled", async () => {
    const { dependencies, getInsertedTranscript, getSavedInput } = createReadyDependencies({
      ...readySettings,
      historyEnabled: true,
      saveTranscriptAudio: true,
    });

    registerIpcHandlers(dependencies);

    await invoke(IpcChannels.stopTestDictation, {
      wavBytes: new Uint8Array([1, 2, 3, 4]),
      durationMs: 1200,
    });

    expect(getSavedInput()).toEqual({ transcriptId: transcript.id, sourcePath: capturedAudioPath });
    expect(getInsertedTranscript()?.audioFileName).toBe(`${transcript.id}.wav`);
    expect(getInsertedTranscript()?.audioMimeType).toBe("audio/wav");
    expect(getInsertedTranscript()?.audioByteSize).toBe(4);
  });

  it("does not preserve audio when history is disabled", async () => {
    const { dependencies, getInsertedTranscript, getSavedInput } = createReadyDependencies({
      ...readySettings,
      historyEnabled: false,
      saveTranscriptAudio: true,
    });

    registerIpcHandlers(dependencies);

    const result = await invoke<TranscriptRecord>(IpcChannels.stopTestDictation, {
      wavBytes: new Uint8Array([1, 2, 3, 4]),
      durationMs: 1200,
    });

    expect(getSavedInput()).toBeNull();
    expect(result.audioFileName).toBeNull();
    expect(getInsertedTranscript()).toBeNull();
  });

  it("does not preserve audio when transcript audio saving is disabled", async () => {
    const { dependencies, getInsertedTranscript, getSavedInput } = createReadyDependencies({
      ...readySettings,
      historyEnabled: true,
      saveTranscriptAudio: false,
    });

    registerIpcHandlers(dependencies);

    await invoke(IpcChannels.stopTestDictation, {
      wavBytes: new Uint8Array([1, 2, 3, 4]),
      durationMs: 1200,
    });

    expect(getSavedInput()).toBeNull();
    expect(getInsertedTranscript()?.audioFileName).toBeNull();
  });

  it("does not preserve audio when settings test dictation detects no speech", async () => {
    const { dependencies, getSavedInput } = createReadyDependencies(
      {
        ...readySettings,
        historyEnabled: true,
        saveTranscriptAudio: true,
      },
      {},
      { text: "   " },
    );

    registerIpcHandlers(dependencies);

    await expect(
      invoke(IpcChannels.stopTestDictation, {
        wavBytes: new Uint8Array([1, 2, 3, 4]),
        durationMs: 1200,
      }),
    ).rejects.toThrow("No speech detected");

    expect(getSavedInput()).toBeNull();
  });

  it("does not preserve audio on the WhisperKit stop path when no speech is detected", async () => {
    const { dependencies, getSavedInput } = createReadyDependencies(
      {
        ...readySettings,
        activeModelId: readyWhisperKitModel.id,
        historyEnabled: true,
        saveTranscriptAudio: true,
      },
      {
        whisperKitBridge: {
          getAvailability: () =>
            Effect.succeed({
              status: "available" as const,
              reason: null,
            }),
        },
      },
      { text: "   ", modelId: readyWhisperKitModel.id, runtime: readyWhisperKitModel.runtime },
      readyWhisperKitModel,
    );

    registerIpcHandlers(dependencies);

    await expect(
      invoke(IpcChannels.stopTestDictation, {
        wavBytes: new Uint8Array([1, 2, 3, 4]),
        durationMs: 1200,
      }),
    ).rejects.toThrow("No speech detected");

    expect(getSavedInput()).toBeNull();
  });

  it("deletes preserved audio when history insert fails on the whisper.cpp stop path", async () => {
    const deletedFileNames: Array<readonly string[]> = [];
    const { dependencies } = createReadyDependencies(
      {
        ...readySettings,
        historyEnabled: true,
        saveTranscriptAudio: true,
      },
      {},
      {},
      readyModel,
      {
        insertTranscript: () => Effect.fail(new Error("insert failed")),
        transcriptAudioStore: {
          saveWavForTranscript: ({ transcriptId }) =>
            Effect.succeed({
              audioFileName: `${transcriptId}.wav`,
              audioMimeType: "audio/wav",
              audioByteSize: 4,
            }),
          loadByFileName: () =>
            Effect.succeed({
              bytes: new Uint8Array([1, 2, 3, 4]),
              mimeType: "audio/wav" as const,
              byteSize: 4,
            }),
          listFileNames: () => Effect.succeed([]),
          deleteByFileNames: (fileNames) =>
            Effect.sync(() => {
              deletedFileNames.push(fileNames);
            }),
        },
      },
    );

    registerIpcHandlers(dependencies);

    await expect(
      invoke(IpcChannels.stopTestDictation, {
        wavBytes: new Uint8Array([1, 2, 3, 4]),
        durationMs: 1200,
      }),
    ).rejects.toThrow("insert failed");

    expect(deletedFileNames).toEqual([["tr_audio.wav"]]);
  });

  it("inserts text history and reports an observer error when audio preservation fails", async () => {
    const preservationErrors: string[] = [];
    const { dependencies, getInsertedTranscript } = createReadyDependencies(
      {
        ...readySettings,
        historyEnabled: true,
        saveTranscriptAudio: true,
      },
      {
        onTranscriptAudioPreservationError: (error: Error) =>
          Effect.sync(() => {
            preservationErrors.push(error.message);
          }),
      },
      {},
      readyModel,
      {
        transcriptAudioStore: {
          saveWavForTranscript: () => Effect.fail(new Error("copy failed")),
          loadByFileName: () =>
            Effect.succeed({
              bytes: new Uint8Array([1, 2, 3, 4]),
              mimeType: "audio/wav" as const,
              byteSize: 4,
            }),
          listFileNames: () => Effect.succeed([]),
          deleteByFileNames: () => Effect.void,
        },
      },
    );

    registerIpcHandlers(dependencies);

    await expect(
      invoke<TranscriptRecord>(IpcChannels.stopTestDictation, {
        wavBytes: new Uint8Array([1, 2, 3, 4]),
        durationMs: 1200,
      }),
    ).resolves.toMatchObject({
      text: "hello",
      audioFileName: null,
      audioMimeType: null,
      audioByteSize: null,
    });

    expect(getInsertedTranscript()).toMatchObject({
      text: "hello",
      audioFileName: null,
      audioMimeType: null,
      audioByteSize: null,
    });
    expect(preservationErrors).toEqual(["copy failed"]);
  });

  it("surfaces cleanup failure when deleting preserved audio after history insert failure fails", async () => {
    const deletedFileNames: Array<readonly string[]> = [];
    const { dependencies } = createReadyDependencies(
      {
        ...readySettings,
        historyEnabled: true,
        saveTranscriptAudio: true,
      },
      {},
      {},
      readyModel,
      {
        insertTranscript: () => Effect.fail(new Error("insert failed")),
        transcriptAudioStore: {
          saveWavForTranscript: ({ transcriptId }) =>
            Effect.succeed({
              audioFileName: `${transcriptId}.wav`,
              audioMimeType: "audio/wav",
              audioByteSize: 4,
            }),
          loadByFileName: () =>
            Effect.succeed({
              bytes: new Uint8Array([1, 2, 3, 4]),
              mimeType: "audio/wav" as const,
              byteSize: 4,
            }),
          listFileNames: () => Effect.succeed([]),
          deleteByFileNames: (fileNames) =>
            Effect.sync(() => {
              deletedFileNames.push(fileNames);
            }).pipe(Effect.zipRight(Effect.fail(new Error("cleanup failed")))),
        },
      },
    );

    registerIpcHandlers(dependencies);

    let rejection: unknown = null;
    try {
      await invoke(IpcChannels.stopTestDictation, {
        wavBytes: new Uint8Array([1, 2, 3, 4]),
        durationMs: 1200,
      });
    } catch (error) {
      rejection = error;
    }

    expect(rejection).toBeInstanceOf(Error);
    expect((rejection as Error).message).toContain("insert failed");
    expect((rejection as Error).message).toContain("cleanup failed");
    expect(deletedFileNames).toEqual([["tr_audio.wav"]]);
  });

  it("deletes preserved audio when history insert fails on the WhisperKit stop path", async () => {
    const deletedFileNames: Array<readonly string[]> = [];
    const { dependencies } = createReadyDependencies(
      {
        ...readySettings,
        activeModelId: readyWhisperKitModel.id,
        historyEnabled: true,
        saveTranscriptAudio: true,
      },
      {
        whisperKitBridge: {
          getAvailability: () =>
            Effect.succeed({
              status: "available" as const,
              reason: null,
            }),
        },
      },
      { modelId: readyWhisperKitModel.id, runtime: readyWhisperKitModel.runtime },
      readyWhisperKitModel,
      {
        insertTranscript: () => Effect.fail(new Error("insert failed")),
        transcriptAudioStore: {
          saveWavForTranscript: ({ transcriptId }) =>
            Effect.succeed({
              audioFileName: `${transcriptId}.wav`,
              audioMimeType: "audio/wav",
              audioByteSize: 4,
            }),
          loadByFileName: () =>
            Effect.succeed({
              bytes: new Uint8Array([1, 2, 3, 4]),
              mimeType: "audio/wav" as const,
              byteSize: 4,
            }),
          listFileNames: () => Effect.succeed([]),
          deleteByFileNames: (fileNames) =>
            Effect.sync(() => {
              deletedFileNames.push(fileNames);
            }),
        },
      },
    );

    registerIpcHandlers(dependencies);

    await expect(
      invoke(IpcChannels.stopTestDictation, {
        wavBytes: new Uint8Array([1, 2, 3, 4]),
        durationMs: 1200,
      }),
    ).rejects.toThrow("insert failed");

    expect(deletedFileNames).toEqual([["tr_audio.wav"]]);
  });

  it("loads transcript audio bytes by transcript id", async () => {
    const dependencies = createDependencies({
      database: {
        ...createDependencies().database,
        transcripts: {
          ...createDependencies().database.transcripts,
          getById: () =>
            Effect.succeed({
              ...transcript,
              audioFileName: "tr_audio.wav",
              audioMimeType: "audio/wav",
              audioByteSize: 4,
            }),
        },
      },
      transcriptAudioStore: {
        saveWavForTranscript: () => Effect.fail(new Error("not implemented")),
        loadByFileName: (fileName: string) =>
          Effect.succeed({
            bytes: new Uint8Array(fileName === "tr_audio.wav" ? [1, 2, 3, 4] : []),
            mimeType: "audio/wav" as const,
            byteSize: 4,
          }),
        listFileNames: () => Effect.succeed([]),
        deleteByFileNames: () => Effect.void,
      },
    });

    registerIpcHandlers(dependencies);

    await expect(
      invoke(IpcChannels.loadTranscriptAudio, { id: "tr_audio" }),
    ).resolves.toMatchObject({
      mimeType: "audio/wav",
      byteSize: 4,
    });
  });

  it("deletes saved audio after deleting a transcript row", async () => {
    const calls: string[] = [];
    const dependencies = createDependencies({
      database: {
        ...createDependencies().database,
        transcripts: {
          ...createDependencies().database.transcripts,
          getAudioFileNameById: () =>
            Effect.sync(() => {
              calls.push("get-audio-file");
              return "tr_audio.wav";
            }),
          deleteById: () =>
            Effect.sync(() => {
              calls.push("delete-row");
            }),
        },
      },
      transcriptAudioStore: {
        saveWavForTranscript: () => Effect.fail(new Error("not implemented")),
        loadByFileName: () => Effect.fail(new Error("not implemented")),
        listFileNames: () => Effect.succeed([]),
        deleteByFileNames: (fileNames: readonly string[]) =>
          Effect.sync(() => {
            calls.push(`delete-files:${fileNames.join(",")}`);
          }),
      },
    });

    registerIpcHandlers(dependencies);

    await invoke(IpcChannels.deleteTranscript, { id: "tr_audio" });

    expect(calls).toEqual(["get-audio-file", "delete-files:tr_audio.wav", "delete-row"]);
  });

  it("rejects transcript deletion when saved audio deletion fails", async () => {
    const calls: string[] = [];
    const dependencies = createDependencies({
      database: {
        ...createDependencies().database,
        transcripts: {
          ...createDependencies().database.transcripts,
          getAudioFileNameById: () =>
            Effect.sync(() => {
              calls.push("get-audio-file");
              return "tr_audio.wav";
            }),
          deleteById: () =>
            Effect.sync(() => {
              calls.push("delete-row");
            }),
        },
      },
      transcriptAudioStore: {
        saveWavForTranscript: () => Effect.fail(new Error("not implemented")),
        loadByFileName: () => Effect.fail(new Error("not implemented")),
        listFileNames: () => Effect.succeed([]),
        deleteByFileNames: () =>
          Effect.sync(() => {
            calls.push("delete-files");
          }).pipe(Effect.zipRight(Effect.fail(new Error("permission denied")))),
      },
    });

    registerIpcHandlers(dependencies);

    await expect(invoke(IpcChannels.deleteTranscript, { id: "tr_audio" })).rejects.toThrow(
      "permission denied",
    );
    expect(calls).toEqual(["get-audio-file", "delete-files"]);
  });

  it("deletes saved audio after clearing transcript rows", async () => {
    const calls: string[] = [];
    const dependencies = createDependencies({
      database: {
        ...createDependencies().database,
        transcripts: {
          ...createDependencies().database.transcripts,
          listAudioFileNames: () =>
            Effect.sync(() => {
              calls.push("list-audio-files");
              return ["tr_1.wav", "tr_2.wav"];
            }),
          clear: () =>
            Effect.sync(() => {
              calls.push("clear-rows");
            }),
        },
      },
      transcriptAudioStore: {
        saveWavForTranscript: () => Effect.fail(new Error("not implemented")),
        loadByFileName: () => Effect.fail(new Error("not implemented")),
        listFileNames: () => Effect.succeed([]),
        deleteByFileNames: (fileNames: readonly string[]) =>
          Effect.sync(() => {
            calls.push(`delete-files:${fileNames.join(",")}`);
          }),
      },
    });

    registerIpcHandlers(dependencies);

    await invoke(IpcChannels.clearTranscripts);

    expect(calls).toEqual([
      "list-audio-files",
      "delete-files:tr_1.wav,tr_2.wav",
      "clear-rows",
      "list-audio-files",
    ]);
  });

  it("rejects transcript clearing when saved audio deletion fails", async () => {
    const calls: string[] = [];
    const dependencies = createDependencies({
      database: {
        ...createDependencies().database,
        transcripts: {
          ...createDependencies().database.transcripts,
          listAudioFileNames: () =>
            Effect.sync(() => {
              calls.push("list-audio-files");
              return ["tr_1.wav"];
            }),
          clear: () =>
            Effect.sync(() => {
              calls.push("clear-rows");
            }),
        },
      },
      transcriptAudioStore: {
        saveWavForTranscript: () => Effect.fail(new Error("not implemented")),
        loadByFileName: () => Effect.fail(new Error("not implemented")),
        listFileNames: () => Effect.succeed([]),
        deleteByFileNames: () =>
          Effect.sync(() => {
            calls.push("delete-files");
          }).pipe(Effect.zipRight(Effect.fail(new Error("permission denied")))),
      },
    });

    registerIpcHandlers(dependencies);

    await expect(invoke(IpcChannels.clearTranscripts)).rejects.toThrow("permission denied");
    expect(calls).toEqual(["list-audio-files", "delete-files"]);
  });

  it("deletes saved audio after pruning expired transcript rows", async () => {
    const calls: string[] = [];
    const dependencies = createDependencies({
      database: {
        ...createDependencies().database,
        settings: {
          get: () =>
            Effect.succeed({
              ...DEFAULT_APP_SETTINGS,
              autoDeleteHistoryDays: 1,
            }),
          set: (settings: typeof DEFAULT_APP_SETTINGS) => Effect.succeed(settings),
        },
        transcripts: {
          ...createDependencies().database.transcripts,
          getAudioFileNamesCreatedBefore: () =>
            Effect.sync(() => {
              calls.push("list-expired-audio-files");
              return ["old.wav"];
            }),
          deleteCreatedBefore: () =>
            Effect.sync(() => {
              calls.push("delete-expired-rows");
            }),
        },
      },
      transcriptAudioStore: {
        saveWavForTranscript: () => Effect.fail(new Error("not implemented")),
        loadByFileName: () => Effect.fail(new Error("not implemented")),
        listFileNames: () => Effect.succeed([]),
        deleteByFileNames: (fileNames: readonly string[]) =>
          Effect.sync(() => {
            calls.push(`delete-files:${fileNames.join(",")}`);
          }),
      },
    });

    registerIpcHandlers(dependencies);

    await invoke(IpcChannels.listTranscripts, {});

    expect(calls).toEqual([
      "list-expired-audio-files",
      "delete-files:old.wav",
      "delete-expired-rows",
    ]);
  });

  it("deletes unreferenced saved audio before listing transcripts", async () => {
    const calls: string[] = [];
    const dependencies = createDependencies({
      database: {
        ...createDependencies().database,
        transcripts: {
          ...createDependencies().database.transcripts,
          listAudioFileNames: () =>
            Effect.sync(() => {
              calls.push("list-referenced-audio-files");
              return ["referenced.wav"];
            }),
          list: () => Effect.succeed([]),
        },
      },
      transcriptAudioStore: {
        saveWavForTranscript: () => Effect.fail(new Error("not implemented")),
        loadByFileName: () => Effect.fail(new Error("not implemented")),
        listFileNames: () =>
          Effect.sync(() => {
            calls.push("list-stored-audio-files");
            return ["orphan.wav", "referenced.wav"];
          }),
        deleteByFileNames: (fileNames: readonly string[]) =>
          Effect.sync(() => {
            calls.push(`delete-files:${fileNames.join(",")}`);
          }),
      },
    });

    registerIpcHandlers(dependencies);

    await invoke(IpcChannels.listTranscripts, {});

    expect(calls).toEqual([
      "list-stored-audio-files",
      "list-referenced-audio-files",
      "delete-files:orphan.wav",
    ]);
  });

  it("rejects transcript pruning when saved audio deletion fails", async () => {
    const calls: string[] = [];
    const dependencies = createDependencies({
      database: {
        ...createDependencies().database,
        settings: {
          get: () =>
            Effect.succeed({
              ...DEFAULT_APP_SETTINGS,
              autoDeleteHistoryDays: 1,
            }),
          set: (settings: typeof DEFAULT_APP_SETTINGS) => Effect.succeed(settings),
        },
        transcripts: {
          ...createDependencies().database.transcripts,
          getAudioFileNamesCreatedBefore: () =>
            Effect.sync(() => {
              calls.push("list-expired-audio-files");
              return ["old.wav"];
            }),
          deleteCreatedBefore: () =>
            Effect.sync(() => {
              calls.push("delete-expired-rows");
            }),
        },
      },
      transcriptAudioStore: {
        saveWavForTranscript: () => Effect.fail(new Error("not implemented")),
        loadByFileName: () => Effect.fail(new Error("not implemented")),
        listFileNames: () => Effect.succeed([]),
        deleteByFileNames: () =>
          Effect.sync(() => {
            calls.push("delete-files");
          }).pipe(Effect.zipRight(Effect.fail(new Error("permission denied")))),
      },
    });

    registerIpcHandlers(dependencies);

    await expect(invoke(IpcChannels.listTranscripts, {})).rejects.toThrow("permission denied");
    expect(calls).toEqual(["list-expired-audio-files", "delete-files"]);
  });
});
