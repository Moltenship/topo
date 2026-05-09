import { BrowserWindow, clipboard, ipcMain } from "electron";
import { Effect } from "effect";
import * as Schema from "effect/Schema";
import type { DictationOrchestrator } from "@molten-voice/asr";
import type { AppDatabase } from "@molten-voice/db";
import { bundledModelCatalog } from "@molten-voice/model-catalog";
import type { NativeBridgeService } from "@molten-voice/native-bridge";
import type { AppSettings, AppStateSnapshot, TranscriptRecord } from "@molten-voice/shared";
import { DEFAULT_APP_SETTINGS } from "@molten-voice/shared";
import {
  CancelModelInstallRequest,
  CopyTranscriptRequest,
  DeleteTranscriptRequest,
  InstallModelRequest,
  IpcChannels,
  ListTranscriptsRequest,
  ReinsertTranscriptRequest,
  UpdateSettingsRequest,
} from "@molten-voice/shared";
import type { ModelInstallJob } from "./model-install-job";
import { computeModelReadiness } from "./model-readiness";
import type { WhisperCppRuntimeResolver } from "./whisper-cpp-runtime";

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

let currentErrorMessage: string | null = null;

interface IpcHandlerDependencies {
  readonly database: AppDatabase;
  readonly dictation: DictationOrchestrator;
  readonly modelInstallJob: ModelInstallJob;
  readonly nativeBridge: NativeBridgeService;
  readonly whisperCppRuntimeResolver?: WhisperCppRuntimeResolver;
  readonly onAppStateChanged?: (snapshot: AppStateSnapshot) => void;
}

let overlayHideTimer: NodeJS.Timeout | null = null;

const clearOverlayHideTimer = () => {
  if (overlayHideTimer) {
    clearTimeout(overlayHideTimer);
    overlayHideTimer = null;
  }
};

const decodeIpcPayload = <A, I, R>(
  schema: Schema.Schema<A, I, R>,
  payload: unknown,
): Effect.Effect<A, Error, R> =>
  Schema.decodeUnknown(schema)(payload).pipe(
    Effect.mapError((error) => new Error(`Invalid IPC payload: ${String(error)}`)),
  );

const getSettings = (dependencies: IpcHandlerDependencies): Effect.Effect<AppSettings> =>
  Effect.gen(function* () {
    return (yield* dependencies.database.settings.get()) ?? DEFAULT_APP_SETTINGS;
  });

const pruneExpiredTranscripts = (
  dependencies: IpcHandlerDependencies,
  settings: AppSettings,
): Effect.Effect<void> => {
  if (settings.autoDeleteHistoryDays === null) {
    return Effect.void;
  }

  const retentionMs = settings.autoDeleteHistoryDays * 24 * 60 * 60 * 1000;
  const cutoffIso = new Date(Date.now() - retentionMs).toISOString();

  return dependencies.database.transcripts.deleteCreatedBefore(cutoffIso);
};

const listTranscripts = (
  dependencies: IpcHandlerDependencies,
  query?: string,
): Effect.Effect<readonly TranscriptRecord[]> =>
  Effect.gen(function* () {
    const settings = yield* getSettings(dependencies);

    yield* pruneExpiredTranscripts(dependencies, settings);

    return yield* dependencies.database.transcripts.list(query);
  });

const getAppState = (dependencies: IpcHandlerDependencies): Effect.Effect<AppStateSnapshot> =>
  Effect.gen(function* () {
    const settings = yield* getSettings(dependencies);
    yield* pruneExpiredTranscripts(dependencies, settings);
    const transcripts = yield* dependencies.database.transcripts.list();
    const installedModels = yield* dependencies.database.installedModels.list();
    const installedModelsByModelId = new Map(
      installedModels.map((model) => [model.modelId, model] as const),
    );
    const shouldProbeWhisperCppRuntime = bundledModelCatalog.some((model) => {
      const installedModel = installedModelsByModelId.get(model.id);

      return model.runtime === "whisper-cpp" && installedModel?.verificationStatus === "verified";
    });
    const whisperCppRuntimeResult =
      shouldProbeWhisperCppRuntime && dependencies.whisperCppRuntimeResolver
        ? yield* dependencies.whisperCppRuntimeResolver.resolve()
        : null;
    const modelReadiness = bundledModelCatalog.map((model) =>
      computeModelReadiness({
        modelId: model.id,
        runtime: model.runtime,
        installedModel: installedModelsByModelId.get(model.id) ?? null,
        runtimeResult: model.runtime === "whisper-cpp" ? whisperCppRuntimeResult : null,
      }),
    );

    return {
      setupComplete: Boolean(settings.activeModelId),
      overlayState: state.overlayState,
      settings,
      transcripts,
      installedModels,
      modelReadiness,
      modelInstallProgress: dependencies.modelInstallJob.getCurrentProgress(),
      errorMessage: currentErrorMessage,
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

const deleteTranscript = (dependencies: IpcHandlerDependencies, id: string): Effect.Effect<void> =>
  dependencies.database.transcripts.deleteById(id);

const clearTranscripts = (dependencies: IpcHandlerDependencies): Effect.Effect<void> =>
  dependencies.database.transcripts.clear();

const getTranscriptById = (
  dependencies: IpcHandlerDependencies,
  id: string,
): Effect.Effect<TranscriptRecord, Error> =>
  Effect.gen(function* () {
    const transcript = yield* dependencies.database.transcripts.getById(id);

    if (!transcript) {
      return yield* Effect.fail(new Error("Transcript not found."));
    }

    return transcript;
  });

const copyTranscript = (
  dependencies: IpcHandlerDependencies,
  id: string,
): Effect.Effect<void, Error> =>
  Effect.gen(function* () {
    const transcript = yield* getTranscriptById(dependencies, id);

    yield* Effect.sync(() => clipboard.writeText(transcript.text));
  });

const reinsertTranscript = (
  dependencies: IpcHandlerDependencies,
  id: string,
): Effect.Effect<void, Error> =>
  Effect.gen(function* () {
    const transcript = yield* getTranscriptById(dependencies, id);
    const settings = yield* getSettings(dependencies);

    const insertion = yield* dependencies.nativeBridge.insertText({
      text: transcript.text,
      mode: settings.insertionMode,
    });

    if (!insertion.inserted) {
      return yield* Effect.fail(new Error("Transcript insertion failed."));
    }
  });

const updateSettings = (
  dependencies: IpcHandlerDependencies,
  settings: AppSettings,
): Effect.Effect<AppSettings> =>
  Effect.gen(function* () {
    currentErrorMessage = null;
    state.settings = settings;
    state.setupComplete = Boolean(settings.activeModelId);

    return yield* dependencies.database.settings.set(settings);
  });

const startTestDictation = (dependencies: IpcHandlerDependencies): Effect.Effect<void> =>
  Effect.gen(function* () {
    currentErrorMessage = null;
    clearOverlayHideTimer();
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
      currentErrorMessage = "No bundled transcription model is available.";
      state.overlayState = "error";

      return yield* Effect.fail(new Error("No bundled transcription model is available"));
    }

    const transcript = yield* dependencies.dictation.stop({
      language: settings.language,
      modelId: selectedModel.id,
      runtime: selectedModel.runtime,
      postProcessingMode: settings.postProcessingMode,
    });
    const insertion = yield* dependencies.nativeBridge.insertText({
      text: transcript.text,
      mode: settings.insertionMode,
    });
    const transcriptWithInsertion: TranscriptRecord = {
      ...transcript,
      insertionMode: settings.insertionMode,
      insertionStatus: insertion.inserted ? "inserted" : "failed",
      targetAppName: insertion.targetAppName,
    };

    state.overlayState = "inserted";
    currentErrorMessage = null;

    if (settings.historyEnabled) {
      yield* dependencies.database.transcripts.insert(transcriptWithInsertion);
    }

    return transcriptWithInsertion;
  });

export const registerIpcHandlers = (dependencies: IpcHandlerDependencies) => {
  ipcMain.handle(IpcChannels.windowMinimize, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize();
  });
  ipcMain.handle(IpcChannels.windowMaximize, (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);

    if (!window) {
      return;
    }

    if (window.isMaximized()) {
      window.unmaximize();
      return;
    }

    window.maximize();
  });
  ipcMain.handle(IpcChannels.windowClose, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close();
  });
  ipcMain.handle(IpcChannels.getAppState, () => Effect.runPromise(getAppState(dependencies)));
  ipcMain.handle(IpcChannels.listTranscripts, (_event, input: unknown) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const payload = yield* decodeIpcPayload(ListTranscriptsRequest, input);

        return yield* listTranscripts(dependencies, payload.query);
      }),
    ),
  );
  ipcMain.handle(IpcChannels.copyTranscript, (_event, input: unknown) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const payload = yield* decodeIpcPayload(CopyTranscriptRequest, input);

        yield* copyTranscript(dependencies, payload.id);
      }),
    ),
  );
  ipcMain.handle(IpcChannels.reinsertTranscript, (_event, input: unknown) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const payload = yield* decodeIpcPayload(ReinsertTranscriptRequest, input);

        yield* reinsertTranscript(dependencies, payload.id);
      }),
    ),
  );
  ipcMain.handle(IpcChannels.deleteTranscript, (_event, input: unknown) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const payload = yield* decodeIpcPayload(DeleteTranscriptRequest, input);

        yield* deleteTranscript(dependencies, payload.id);
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
  ipcMain.handle(IpcChannels.updateSettings, (_event, input: unknown) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const settings = yield* decodeIpcPayload(UpdateSettingsRequest, input);
        const nextSettings = yield* updateSettings(dependencies, settings);
        yield* publishAppState(dependencies);

        return nextSettings;
      }),
    ),
  );
  ipcMain.handle(IpcChannels.installModel, (_event, input: unknown) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const payload = yield* decodeIpcPayload(InstallModelRequest, input);
        const progress = yield* dependencies.modelInstallJob.start(payload.modelId, () => {
          void Effect.runPromise(
            Effect.gen(function* () {
              const installedProgress = dependencies.modelInstallJob.getCurrentProgress();

              if (installedProgress?.status === "installed") {
                const model = bundledModelCatalog.find(
                  (model) => model.id === installedProgress.modelId,
                );

                if (model) {
                  yield* dependencies.database.installedModels.upsert({
                    id: `installed_${model.id}`,
                    modelId: model.id,
                    runtime: model.runtime,
                    sourceType: model.source.type,
                    sourceRevision:
                      "revision" in model.source
                        ? model.source.revision
                        : "tag" in model.source
                          ? model.source.tag
                          : model.downloadUrl,
                    installedPath:
                      dependencies.modelInstallJob.getInstalledModelPath(model.id) ??
                      model.downloadUrl,
                    checksumSha256: model.checksumSha256,
                    verificationStatus: "verified",
                    installedAt: new Date().toISOString(),
                  });
                }
              }

              yield* publishAppState(dependencies);
            }),
          );
        });
        yield* publishAppState(dependencies);

        return progress;
      }),
    ),
  );
  ipcMain.handle(IpcChannels.cancelModelInstall, (_event, input: unknown) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const payload = yield* decodeIpcPayload(CancelModelInstallRequest, input);

        yield* dependencies.modelInstallJob.cancel(payload.modelId);
        yield* publishAppState(dependencies);
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
        const transcript = yield* stopTestDictation(dependencies).pipe(
          Effect.tapError((error) =>
            Effect.gen(function* () {
              currentErrorMessage = error.message;
              state.overlayState = "error";
              yield* publishAppState(dependencies);
            }),
          ),
        );
        yield* publishAppState(dependencies);
        clearOverlayHideTimer();
        overlayHideTimer = setTimeout(() => {
          state.overlayState = "hidden";
          void Effect.runPromise(publishAppState(dependencies));
        }, 1600);

        return transcript;
      }),
    ),
  );
};
