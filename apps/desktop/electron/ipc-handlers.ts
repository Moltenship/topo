import { BrowserWindow, ipcMain } from "electron";
import { Effect } from "effect";
import type { DictationOrchestrator } from "@molten-voice/asr";
import type { AppDatabase } from "@molten-voice/db";
import { bundledModelCatalog } from "@molten-voice/model-catalog";
import type { AppSettings, AppStateSnapshot, TranscriptRecord } from "@molten-voice/shared";
import { DEFAULT_APP_SETTINGS } from "@molten-voice/shared";
import { IpcChannels } from "@molten-voice/shared";

interface MainProcessState {
  setupComplete: boolean;
  overlayState: AppStateSnapshot["overlayState"];
  settings: AppSettings;
}

const state: MainProcessState = {
  setupComplete: false,
  overlayState: "hidden",
  settings: DEFAULT_APP_SETTINGS,
};

interface IpcHandlerDependencies {
  readonly database: AppDatabase;
  readonly dictation: DictationOrchestrator;
  readonly onAppStateChanged?: (snapshot: AppStateSnapshot) => void;
}

const getSettings = (dependencies: IpcHandlerDependencies): Effect.Effect<AppSettings> =>
  Effect.gen(function* () {
    return (yield* dependencies.database.settings.get()) ?? DEFAULT_APP_SETTINGS;
  });

const getAppState = (dependencies: IpcHandlerDependencies): Effect.Effect<AppStateSnapshot> =>
  Effect.gen(function* () {
    const settings = yield* getSettings(dependencies);
    const transcripts = yield* dependencies.database.transcripts.list();

    return {
      setupComplete: Boolean(settings.activeModelId),
      overlayState: state.overlayState,
      settings,
      transcripts,
    };
  });

const publishAppState = (dependencies: IpcHandlerDependencies): Effect.Effect<void> =>
  Effect.gen(function* () {
    const snapshot = yield* getAppState(dependencies);

    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(IpcChannels.appStateChanged, snapshot);
    }

    dependencies.onAppStateChanged?.(snapshot);
  });

const listTranscripts = (
  dependencies: IpcHandlerDependencies,
  query?: string,
): Effect.Effect<readonly TranscriptRecord[]> => dependencies.database.transcripts.list(query);

const deleteTranscript = (dependencies: IpcHandlerDependencies, id: string): Effect.Effect<void> =>
  dependencies.database.transcripts.deleteById(id);

const clearTranscripts = (dependencies: IpcHandlerDependencies): Effect.Effect<void> =>
  dependencies.database.transcripts.clear();

const updateSettings = (
  dependencies: IpcHandlerDependencies,
  settings: AppSettings,
): Effect.Effect<AppSettings> =>
  Effect.gen(function* () {
    state.settings = settings;
    state.setupComplete = Boolean(settings.activeModelId);

    return yield* dependencies.database.settings.set(settings);
  });

const startTestDictation = (dependencies: IpcHandlerDependencies): Effect.Effect<void> =>
  Effect.gen(function* () {
    yield* dependencies.dictation.start();
    state.overlayState = "recording";
  });

const stopTestDictation = (
  dependencies: IpcHandlerDependencies,
): Effect.Effect<TranscriptRecord, Error> =>
  Effect.gen(function* () {
    const settings = yield* getSettings(dependencies);

    const selectedModel =
      bundledModelCatalog.find((model) => model.id === settings.activeModelId) ??
      bundledModelCatalog[0];

    if (!selectedModel) {
      return yield* Effect.fail(new Error("No bundled transcription model is available"));
    }

    const transcript = yield* dependencies.dictation.stop({
      language: settings.language,
      modelId: selectedModel.id,
      runtime: selectedModel.runtime,
      postProcessingMode: settings.postProcessingMode,
    });

    state.overlayState = "inserted";
    yield* dependencies.database.transcripts.insert(transcript);

    return transcript;
  });

export const registerIpcHandlers = (dependencies: IpcHandlerDependencies) => {
  ipcMain.handle(IpcChannels.getAppState, () => Effect.runPromise(getAppState(dependencies)));
  ipcMain.handle(IpcChannels.listTranscripts, (_event, input: { query?: string }) =>
    Effect.runPromise(listTranscripts(dependencies, input.query)),
  );
  ipcMain.handle(IpcChannels.deleteTranscript, (_event, input: { id: string }) =>
    Effect.runPromise(
      Effect.gen(function* () {
        yield* deleteTranscript(dependencies, input.id);
        yield* publishAppState(dependencies);
      }),
    ),
  );
  ipcMain.handle(IpcChannels.clearTranscripts, () =>
    Effect.runPromise(
      Effect.gen(function* () {
        yield* clearTranscripts(dependencies);
        yield* publishAppState(dependencies);
      }),
    ),
  );
  ipcMain.handle(IpcChannels.updateSettings, (_event, settings: AppSettings) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const nextSettings = yield* updateSettings(dependencies, settings);
        yield* publishAppState(dependencies);

        return nextSettings;
      }),
    ),
  );
  ipcMain.handle(IpcChannels.startTestDictation, () =>
    Effect.runPromise(
      Effect.gen(function* () {
        yield* startTestDictation(dependencies);
        yield* publishAppState(dependencies);
      }),
    ),
  );
  ipcMain.handle(IpcChannels.stopTestDictation, () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const transcript = yield* stopTestDictation(dependencies);
        yield* publishAppState(dependencies);

        return transcript;
      }),
    ),
  );
};
