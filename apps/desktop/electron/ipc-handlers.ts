import { ipcMain } from "electron";
import { Effect } from "effect";
import { bundledModelCatalog } from "@molten-voice/model-catalog";
import type { AppSettings, AppStateSnapshot, TranscriptRecord } from "@molten-voice/shared";
import { DEFAULT_APP_SETTINGS } from "@molten-voice/shared";
import { IpcChannels } from "@molten-voice/shared";

interface MainProcessState {
  setupComplete: boolean;
  overlayState: AppStateSnapshot["overlayState"];
  settings: AppSettings;
  transcripts: TranscriptRecord[];
  activeTestSessionId: string | null;
}

const state: MainProcessState = {
  setupComplete: false,
  overlayState: "hidden",
  settings: DEFAULT_APP_SETTINGS,
  transcripts: [],
  activeTestSessionId: null,
};

const getAppState = (): Effect.Effect<AppStateSnapshot> =>
  Effect.succeed({
    setupComplete: state.setupComplete,
    overlayState: state.overlayState,
    settings: state.settings,
    transcripts: state.transcripts,
  });

const listTranscripts = (query?: string): Effect.Effect<readonly TranscriptRecord[]> =>
  Effect.sync(() => {
    const normalizedQuery = query?.trim().toLowerCase();

    if (!normalizedQuery) {
      return state.transcripts;
    }

    return state.transcripts.filter((transcript) =>
      transcript.text.toLowerCase().includes(normalizedQuery),
    );
  });

const deleteTranscript = (id: string): Effect.Effect<void> =>
  Effect.sync(() => {
    state.transcripts = state.transcripts.filter((transcript) => transcript.id !== id);
  });

const clearTranscripts = (): Effect.Effect<void> =>
  Effect.sync(() => {
    state.transcripts = [];
  });

const updateSettings = (settings: AppSettings): Effect.Effect<AppSettings> =>
  Effect.sync(() => {
    state.settings = settings;
    state.setupComplete = Boolean(settings.activeModelId);

    return state.settings;
  });

const startTestDictation = (): Effect.Effect<void> =>
  Effect.sync(() => {
    state.activeTestSessionId = `test_${Date.now()}`;
    state.overlayState = "recording";
  });

const stopTestDictation = (): Effect.Effect<TranscriptRecord, Error> =>
  Effect.sync(() => {
    if (!state.activeTestSessionId) {
      throw new Error("No active test dictation session");
    }

    const selectedModel =
      bundledModelCatalog.find((model) => model.id === state.settings.activeModelId) ??
      bundledModelCatalog[0];

    if (!selectedModel) {
      throw new Error("No bundled transcription model is available");
    }

    const transcript: TranscriptRecord = {
      id: `transcript_${Date.now()}`,
      text: "Hello world",
      createdAt: new Date().toISOString(),
      durationMs: 1200,
      modelId: selectedModel.id,
      runtime: selectedModel.runtime,
      language: state.settings.language,
      recordingMode: state.settings.recordingMode,
      stopReason: "hotkey-release",
      insertionMode: state.settings.insertionMode,
      insertionStatus: "skipped",
      targetAppName: null,
    };

    state.activeTestSessionId = null;
    state.overlayState = "inserted";
    state.transcripts = [transcript, ...state.transcripts];

    return transcript;
  });

export const registerIpcHandlers = () => {
  ipcMain.handle(IpcChannels.getAppState, () => Effect.runPromise(getAppState()));
  ipcMain.handle(IpcChannels.listTranscripts, (_event, input: { query?: string }) =>
    Effect.runPromise(listTranscripts(input.query)),
  );
  ipcMain.handle(IpcChannels.deleteTranscript, (_event, input: { id: string }) =>
    Effect.runPromise(deleteTranscript(input.id)),
  );
  ipcMain.handle(IpcChannels.clearTranscripts, () => Effect.runPromise(clearTranscripts()));
  ipcMain.handle(IpcChannels.updateSettings, (_event, settings: AppSettings) =>
    Effect.runPromise(updateSettings(settings)),
  );
  ipcMain.handle(IpcChannels.startTestDictation, () => Effect.runPromise(startTestDictation()));
  ipcMain.handle(IpcChannels.stopTestDictation, () => Effect.runPromise(stopTestDictation()));
};
