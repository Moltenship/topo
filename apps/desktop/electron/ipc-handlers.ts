import { ipcMain } from "electron";
import { Effect } from "effect";
import type { AppDatabase } from "@molten-voice/db";
import { bundledModelCatalog } from "@molten-voice/model-catalog";
import type { AppSettings, AppStateSnapshot, TranscriptRecord } from "@molten-voice/shared";
import { DEFAULT_APP_SETTINGS } from "@molten-voice/shared";
import { IpcChannels } from "@molten-voice/shared";

interface MainProcessState {
  setupComplete: boolean;
  overlayState: AppStateSnapshot["overlayState"];
  settings: AppSettings;
  activeTestSessionId: string | null;
}

const state: MainProcessState = {
  setupComplete: false,
  overlayState: "hidden",
  settings: DEFAULT_APP_SETTINGS,
  activeTestSessionId: null,
};

interface IpcHandlerDependencies {
  readonly database: AppDatabase;
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

const startTestDictation = (): Effect.Effect<void> =>
  Effect.sync(() => {
    state.activeTestSessionId = `test_${Date.now()}`;
    state.overlayState = "recording";
  });

const stopTestDictation = (
  dependencies: IpcHandlerDependencies,
): Effect.Effect<TranscriptRecord, Error> =>
  Effect.gen(function* () {
    const settings = yield* getSettings(dependencies);

    if (!state.activeTestSessionId) {
      return yield* Effect.fail(new Error("No active test dictation session"));
    }

    const selectedModel =
      bundledModelCatalog.find((model) => model.id === settings.activeModelId) ??
      bundledModelCatalog[0];

    if (!selectedModel) {
      return yield* Effect.fail(new Error("No bundled transcription model is available"));
    }

    const transcript: TranscriptRecord = {
      id: `transcript_${Date.now()}`,
      text: "Hello world",
      createdAt: new Date().toISOString(),
      durationMs: 1200,
      modelId: selectedModel.id,
      runtime: selectedModel.runtime,
      language: settings.language,
      recordingMode: settings.recordingMode,
      stopReason: "hotkey-release",
      insertionMode: settings.insertionMode,
      insertionStatus: "skipped",
      targetAppName: null,
    };

    state.activeTestSessionId = null;
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
    Effect.runPromise(deleteTranscript(dependencies, input.id)),
  );
  ipcMain.handle(IpcChannels.clearTranscripts, () =>
    Effect.runPromise(clearTranscripts(dependencies)),
  );
  ipcMain.handle(IpcChannels.updateSettings, (_event, settings: AppSettings) =>
    Effect.runPromise(updateSettings(dependencies, settings)),
  );
  ipcMain.handle(IpcChannels.startTestDictation, () => Effect.runPromise(startTestDictation()));
  ipcMain.handle(IpcChannels.stopTestDictation, () =>
    Effect.runPromise(stopTestDictation(dependencies)),
  );
};
