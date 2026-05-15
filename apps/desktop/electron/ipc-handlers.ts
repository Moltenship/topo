import { BrowserWindow, clipboard, ipcMain } from "electron";
import { Effect } from "effect";
import * as Schema from "effect/Schema";
import type { DictationOrchestrator } from "@topo/asr";
import type { AppDatabase } from "@topo/db";
import {
  bundledModelCatalog,
  bundledRuntimeCatalog,
  type ModelCatalogEntry,
  type RuntimeCatalogEntry,
  type RuntimeId,
  type RuntimePlatform,
} from "@topo/model-catalog";
import type { NativeBridgeService } from "@topo/native-bridge";
import type { AppleIntelligenceService } from "@topo/native-bridge";
import type {
  AppSettings,
  AppStateSnapshot,
  InstallBundleProgress,
  NativeHotkeyEvent,
  TranscriptRecord,
} from "@topo/shared";
import { canStartDictation, DEFAULT_APP_SETTINGS } from "@topo/shared";
import type { SubmittedAudioCaptureService } from "@topo/audio";
import {
  CancelModelInstallRequest,
  CommitOverlayPreviewPositionRequest,
  CopyTranscriptRequest,
  DeleteTranscriptRequest,
  InstallModelRequest,
  InstallModelBundleRequest,
  IpcChannels,
  ListTranscriptsRequest,
  LoadTranscriptAudioRequest,
  ReinsertTranscriptRequest,
  UpdateSettingsRequest,
} from "@topo/shared";
import type { OverlayPosition } from "@topo/shared";
import type { ModelInstallJob } from "./model-install-job";
import { createInstallPlan } from "./install-plan";
import { getModelSourceRevision } from "./model-artifact-revision";
import type { RuntimeInstallJob } from "./runtime-install-job";
import {
  computeModelReadinessForCatalog,
  createWhisperCppRuntimeReadinessCache,
  shouldResolveWhisperCppRuntimeForCatalog,
  type WhisperCppRuntimeReadinessCache,
} from "./model-readiness";
import type { WhisperCppRuntimeResolver } from "./whisper-cpp-runtime";
import type { WhisperKitBridge } from "./whisperkit-bridge";
import { createHotkeyCoordinator } from "./hotkey-coordinator";

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
let currentBundleInstallProgress: InstallBundleProgress | null = null;

interface IpcHandlerDependencies {
  readonly database: AppDatabase;
  readonly dictation: DictationOrchestrator;
  readonly audio?: SubmittedAudioCaptureService;
  readonly modelInstallJob: ModelInstallJob;
  readonly runtimeInstallJob: RuntimeInstallJob;
  readonly nativeBridge: NativeBridgeService;
  readonly appleIntelligence?: AppleIntelligenceService;
  readonly catalog?: readonly ModelCatalogEntry[];
  readonly runtimeCatalog?: readonly RuntimeCatalogEntry[];
  readonly installPlatform?: RuntimePlatform;
  readonly installArchitecture?: string;
  readonly whisperCppRuntimeReadinessCache?: WhisperCppRuntimeReadinessCache;
  readonly whisperCppRuntimeResolver?: WhisperCppRuntimeResolver;
  readonly whisperKitBridge?: WhisperKitBridge;
  readonly createWhisperCppRuntimeResolver?: (
    installedBinaryPath: string | null,
  ) => WhisperCppRuntimeResolver;
  readonly resolveOverlayPositionFromPreviewPoint?: (point: {
    readonly centerX: number;
    readonly centerY: number;
  }) => OverlayPosition;
  readonly onAppStateChanged?: (snapshot: AppStateSnapshot) => void;
}

let overlayHideTimer: NodeJS.Timeout | null = null;
let hotkeyUnsubscribe: (() => void) | null = null;
const hotkeyCoordinator = createHotkeyCoordinator();

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

const decodeStopTestDictationInput = (
  input: unknown,
): { readonly wavBytes: Uint8Array; readonly durationMs: number } => {
  if (
    typeof input !== "object" ||
    input === null ||
    !("wavBytes" in input) ||
    !("durationMs" in input)
  ) {
    throw new Error("Invalid IPC payload: missing test recording audio");
  }

  const candidate = input as { readonly wavBytes: unknown; readonly durationMs: unknown };
  const wavBytes =
    candidate.wavBytes instanceof Uint8Array
      ? candidate.wavBytes
      : Array.isArray(candidate.wavBytes)
        ? Uint8Array.from(candidate.wavBytes)
        : null;

  if (wavBytes === null || typeof candidate.durationMs !== "number") {
    throw new Error("Invalid IPC payload: invalid test recording audio");
  }

  return { wavBytes, durationMs: candidate.durationMs };
};

const getSettings = (dependencies: IpcHandlerDependencies): Effect.Effect<AppSettings> =>
  Effect.gen(function* () {
    const settings = (yield* dependencies.database.settings.get()) ?? DEFAULT_APP_SETTINGS;

    return settings;
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

const getCatalog = (dependencies: IpcHandlerDependencies): readonly ModelCatalogEntry[] =>
  dependencies.catalog ?? bundledModelCatalog;

const getRuntimeCatalog = (dependencies: IpcHandlerDependencies): readonly RuntimeCatalogEntry[] =>
  dependencies.runtimeCatalog ?? bundledRuntimeCatalog;

const getInstallPlatform = (dependencies: IpcHandlerDependencies): RuntimePlatform => {
  if (dependencies.installPlatform) {
    return dependencies.installPlatform;
  }

  return process.platform === "darwin" ? "macos" : "windows";
};

const getInstallArchitecture = (dependencies: IpcHandlerDependencies): string =>
  dependencies.installArchitecture ?? process.arch;

const defaultWhisperCppRuntimeReadinessCache = createWhisperCppRuntimeReadinessCache();

const getAppState = (dependencies: IpcHandlerDependencies): Effect.Effect<AppStateSnapshot> =>
  Effect.gen(function* () {
    const catalog = getCatalog(dependencies);
    const settings = yield* getSettings(dependencies);
    yield* pruneExpiredTranscripts(dependencies, settings);
    const transcripts = yield* dependencies.database.transcripts.list();
    const installedModels = yield* dependencies.database.installedModels.list();
    const installedRuntimes = yield* dependencies.database.installedRuntimes.list();
    const shouldProbeWhisperCppRuntime = shouldResolveWhisperCppRuntimeForCatalog({
      catalog,
      installedModels,
    });
    const whisperCppRuntimeReadinessCache =
      dependencies.whisperCppRuntimeReadinessCache ?? defaultWhisperCppRuntimeReadinessCache;
    const installedWhisperCppRuntime =
      installedRuntimes.find(
        (runtime) =>
          runtime.engine === "whisper-cpp" &&
          runtime.verificationStatus === "verified" &&
          runtime.binaryPath,
      ) ?? null;
    const whisperCppRuntimeResolver =
      dependencies.createWhisperCppRuntimeResolver?.(
        installedWhisperCppRuntime?.binaryPath ?? null,
      ) ?? dependencies.whisperCppRuntimeResolver;
    const whisperCppRuntimeResult =
      shouldProbeWhisperCppRuntime && whisperCppRuntimeResolver
        ? yield* whisperCppRuntimeReadinessCache.resolve(whisperCppRuntimeResolver)
        : null;
    const shouldProbeWhisperKit = catalog.some((model) => {
      const installedModel = installedModels.find((record) => record.modelId === model.id);

      return model.runtime === "whisperkit" && installedModel?.verificationStatus === "verified";
    });
    const whisperKitAvailability =
      shouldProbeWhisperKit && dependencies.whisperKitBridge
        ? yield* dependencies.whisperKitBridge.getAvailability()
        : null;
    const modelReadiness = computeModelReadinessForCatalog({
      catalog,
      installedModels,
      installedRuntimes,
      whisperCppRuntimeResult,
      whisperKitAvailable: whisperKitAvailability?.status === "available",
      whisperKitAvailabilityMessage: whisperKitAvailability?.reason ?? null,
    });

    return {
      setupComplete: Boolean(settings.activeModelId),
      overlayState: state.overlayState,
      settings,
      transcripts,
      installedModels,
      installedRuntimes,
      modelReadiness,
      modelInstallProgress: dependencies.modelInstallJob.getCurrentProgress(),
      runtimeInstallProgress: dependencies.runtimeInstallJob.getCurrentProgress(),
      bundleInstallProgress: currentBundleInstallProgress,
      errorMessage: currentErrorMessage,
    };
  });

const recordInstalledModel = (
  dependencies: IpcHandlerDependencies,
  model: ModelCatalogEntry,
): Effect.Effect<void> =>
  dependencies.database.installedModels
    .upsert({
      id: `installed_${model.id}`,
      modelId: model.id,
      runtime: model.runtime,
      sourceType: model.source.type,
      sourceRevision: getModelSourceRevision(model),
      installedPath:
        dependencies.modelInstallJob.getInstalledModelPath(model.id) ?? model.downloadUrl,
      checksumSha256: model.checksumSha256,
      verificationStatus: "verified",
      installedAt: new Date().toISOString(),
    })
    .pipe(Effect.asVoid);

const publishAppState = (dependencies: IpcHandlerDependencies): Effect.Effect<void> =>
  Effect.gen(function* () {
    const snapshot = yield* getAppState(dependencies);

    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(IpcChannels.appStateChanged, snapshot);
    }

    dependencies.onAppStateChanged?.(snapshot);
  });

const setBundleProgress = (
  progress: InstallBundleProgress,
  dependencies: IpcHandlerDependencies,
): Effect.Effect<void> =>
  Effect.sync(() => {
    currentBundleInstallProgress = progress;
  }).pipe(Effect.zipRight(publishAppState(dependencies)));

const installModelBundle = (
  dependencies: IpcHandlerDependencies,
  modelId: string,
): Effect.Effect<InstallBundleProgress, Error> =>
  Effect.gen(function* () {
    const catalog = getCatalog(dependencies);
    const runtimeCatalog = getRuntimeCatalog(dependencies);
    const installedModels = yield* dependencies.database.installedModels.list();
    const installedRuntimes = yield* dependencies.database.installedRuntimes.list();
    const plan = createInstallPlan({
      modelId,
      platform: getInstallPlatform(dependencies),
      architecture: getInstallArchitecture(dependencies),
      modelCatalog: catalog,
      runtimeCatalog,
      installedModels,
      installedRuntimes,
    });

    const makeBundleProgress = (
      stage: InstallBundleProgress["stage"],
      errorMessage: string | null = null,
    ): InstallBundleProgress => ({
      modelId: plan.modelId,
      runtimeId: plan.runtimeId,
      stage,
      runtimeProgress: dependencies.runtimeInstallJob.getCurrentProgress(),
      modelProgress: dependencies.modelInstallJob.getCurrentProgress(),
      errorMessage,
    });

    if (plan.runtime && plan.installRuntime) {
      yield* setBundleProgress(makeBundleProgress("runtime"), dependencies);
      const runtimeProgress = yield* dependencies.runtimeInstallJob.start(plan.runtime.id, () => {
        currentBundleInstallProgress = makeBundleProgress("runtime");
        void Effect.runPromise(publishAppState(dependencies));
      });

      if (runtimeProgress.status === "canceled") {
        const canceledProgress = makeBundleProgress("canceled");
        yield* setBundleProgress(canceledProgress, dependencies);

        return canceledProgress;
      }
    }

    if (plan.installModel) {
      yield* setBundleProgress(makeBundleProgress("model"), dependencies);
      const modelProgress = yield* dependencies.modelInstallJob.start(plan.model.id, () => {
        currentBundleInstallProgress = makeBundleProgress("model");
        void Effect.runPromise(publishAppState(dependencies));
      });

      if (modelProgress.status === "canceled") {
        const canceledProgress = makeBundleProgress("canceled");
        yield* setBundleProgress(canceledProgress, dependencies);

        return canceledProgress;
      }

      if (modelProgress.status === "installed") {
        yield* recordInstalledModel(dependencies, plan.model);
      }
    }

    yield* setBundleProgress(makeBundleProgress("readiness"), dependencies);

    const installedProgress = makeBundleProgress("installed");
    yield* setBundleProgress(installedProgress, dependencies);

    return installedProgress;
  }).pipe(
    Effect.tapError((error) =>
      setBundleProgress(
        {
          modelId,
          runtimeId: currentBundleInstallProgress?.runtimeId ?? null,
          stage: "failed",
          runtimeProgress: dependencies.runtimeInstallJob.getCurrentProgress(),
          modelProgress: dependencies.modelInstallJob.getCurrentProgress(),
          errorMessage: error.message,
        },
        dependencies,
      ),
    ),
  );

const publishGlobalHotkeyEvent = (event: NativeHotkeyEvent) => {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(IpcChannels.globalHotkeyEvent, event);
  }
};

const registerNativeHotkey = (
  dependencies: IpcHandlerDependencies,
  hotkey: string,
): Effect.Effect<void> =>
  Effect.gen(function* () {
    const nextUnsubscribe = yield* dependencies.nativeBridge
      .registerHotkey(hotkey, (event) => {
        const effectiveMode = dependencies.nativeBridge.supportsHotkeyReleaseEvents
          ? state.settings.recordingMode
          : "toggle-to-talk";
        const action = hotkeyCoordinator.handle({
          mode: effectiveMode,
          phase: event.phase,
          timestampMs: event.timestampMs,
        });

        if (action === "start-recording") {
          publishGlobalHotkeyEvent({ ...event, phase: "down" });
          return;
        }

        if (action === "stop-recording") {
          publishGlobalHotkeyEvent({ ...event, phase: "up" });
        }
      })
      .pipe(
        Effect.catchAll((error) =>
          Effect.sync(() => {
            currentErrorMessage = `Unable to register global hotkey: ${error.message}`;
            return null;
          }),
        ),
      );

    if (nextUnsubscribe) {
      hotkeyUnsubscribe?.();
      hotkeyUnsubscribe = nextUnsubscribe;
    }
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
): Effect.Effect<AppSettings, Error> =>
  Effect.gen(function* () {
    currentErrorMessage = null;
    state.settings = settings;
    state.setupComplete = Boolean(settings.activeModelId);

    const nextSettings = yield* dependencies.database.settings.set(settings);
    yield* registerNativeHotkey(dependencies, nextSettings.hotkey);

    return nextSettings;
  });

const showOverlayPreview = (dependencies: IpcHandlerDependencies): Effect.Effect<void> =>
  Effect.sync(() => {
    currentErrorMessage = null;
    clearOverlayHideTimer();
    state.overlayState = "preview";
    overlayHideTimer = setTimeout(() => {
      state.overlayState = "hidden";
      overlayHideTimer = null;
      void Effect.runPromise(publishAppState(dependencies));
    }, 8000);
  });

const commitOverlayPreviewPosition = (
  dependencies: IpcHandlerDependencies,
  point: { readonly centerX: number; readonly centerY: number },
): Effect.Effect<AppSettings, Error> =>
  Effect.gen(function* () {
    if (!dependencies.resolveOverlayPositionFromPreviewPoint) {
      return yield* Effect.fail(new Error("Overlay preview positioning is unavailable."));
    }

    const settings = yield* getSettings(dependencies);
    const overlayPosition = dependencies.resolveOverlayPositionFromPreviewPoint(point);

    clearOverlayHideTimer();
    state.overlayState = "hidden";

    return yield* updateSettings(dependencies, { ...settings, overlayPosition });
  });

const startTestDictation = (dependencies: IpcHandlerDependencies): Effect.Effect<void> =>
  Effect.gen(function* () {
    const snapshot = yield* getAppState(dependencies);

    if (
      !canStartDictation({
        settings: snapshot.settings,
        modelReadiness: snapshot.modelReadiness,
      })
    ) {
      return;
    }

    currentErrorMessage = null;
    clearOverlayHideTimer();
    yield* dependencies.dictation.start();
    state.overlayState = "recording";
  });

const stopTestDictation = (
  dependencies: IpcHandlerDependencies,
  submittedAudio: { readonly wavBytes: Uint8Array; readonly durationMs: number },
): Effect.Effect<TranscriptRecord, Error> =>
  Effect.gen(function* () {
    const snapshot = yield* getAppState(dependencies);
    if (
      !canStartDictation({
        settings: snapshot.settings,
        modelReadiness: snapshot.modelReadiness,
      })
    ) {
      currentErrorMessage = "selected_model_not_ready";
      state.overlayState = "error";

      return yield* Effect.fail(new Error("selected_model_not_ready"));
    }

    const catalog = getCatalog(dependencies);
    const settings = snapshot.settings;

    const selectedModel = catalog.find((model) => model.id === settings.activeModelId);

    if (!selectedModel) {
      currentErrorMessage = "No selected transcription model is available.";
      state.overlayState = "error";

      return yield* Effect.fail(new Error("No selected transcription model is available"));
    }

    const installedModel = yield* dependencies.database.installedModels.getByModelId(
      selectedModel.id,
    );

    if (!installedModel || installedModel.verificationStatus !== "verified") {
      currentErrorMessage = "model_not_installed";
      state.overlayState = "error";

      return yield* Effect.fail(new Error("model_not_installed"));
    }

    if (
      selectedModel.runtime !== "whisper-cpp" ||
      (!dependencies.whisperCppRuntimeResolver && !dependencies.createWhisperCppRuntimeResolver)
    ) {
      if (selectedModel.runtime === "whisperkit" && dependencies.whisperKitBridge) {
        state.overlayState = "processing";
        yield* publishAppState(dependencies);

        if (dependencies.audio) {
          yield* dependencies.audio.submitCapturedAudio(submittedAudio);
        }

        const transcript = yield* dependencies.dictation.stop({
          language: settings.language,
          modelId: selectedModel.id,
          runtime: selectedModel.runtime,
          installedModelPath: installedModel.installedPath,
          runtimeBinaryPath: null,
          postProcessingMode: settings.postProcessingMode,
          recordingMode: settings.recordingMode,
        });

        if (transcript.text.trim().length === 0) {
          currentErrorMessage =
            "No speech detected. Hold the hotkey and speak before releasing it.";
          state.overlayState = "error";

          return yield* Effect.fail(new Error(currentErrorMessage));
        }

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

        state.overlayState = "hidden";
        currentErrorMessage = null;

        if (settings.historyEnabled) {
          yield* dependencies.database.transcripts.insert(transcriptWithInsertion);
        }

        return transcriptWithInsertion;
      }

      currentErrorMessage = "runtime_missing";
      state.overlayState = "error";

      return yield* Effect.fail(new Error("runtime_missing"));
    }

    const installedRuntimes = yield* dependencies.database.installedRuntimes.list();
    const installedWhisperCppRuntime =
      installedRuntimes.find(
        (runtime) =>
          runtime.engine === "whisper-cpp" &&
          runtime.verificationStatus === "verified" &&
          runtime.binaryPath,
      ) ?? null;
    const runtimeResolver =
      dependencies.createWhisperCppRuntimeResolver?.(
        installedWhisperCppRuntime?.binaryPath ?? null,
      ) ?? dependencies.whisperCppRuntimeResolver;

    if (!runtimeResolver) {
      currentErrorMessage = "runtime_missing";
      state.overlayState = "error";

      return yield* Effect.fail(new Error("runtime_missing"));
    }

    const runtimeResult = yield* runtimeResolver.resolve();

    if (runtimeResult.status === "missing") {
      currentErrorMessage = "runtime_missing";
      state.overlayState = "error";

      return yield* Effect.fail(new Error("runtime_missing"));
    }

    if (runtimeResult.status === "failed") {
      currentErrorMessage = "runtime-failed";
      state.overlayState = "error";

      return yield* Effect.fail(new Error("runtime-failed"));
    }

    state.overlayState = "processing";
    yield* publishAppState(dependencies);

    if (dependencies.audio) {
      yield* dependencies.audio.submitCapturedAudio(submittedAudio);
    }

    const transcript = yield* dependencies.dictation.stop({
      language: settings.language,
      modelId: selectedModel.id,
      runtime: selectedModel.runtime,
      installedModelPath: installedModel.installedPath,
      runtimeBinaryPath: runtimeResult.binaryPath,
      postProcessingMode: settings.postProcessingMode,
      recordingMode: settings.recordingMode,
    });

    if (transcript.text.trim().length === 0) {
      currentErrorMessage = "No speech detected. Hold the hotkey and speak before releasing it.";
      state.overlayState = "error";

      return yield* Effect.fail(new Error(currentErrorMessage));
    }

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

    state.overlayState = "hidden";
    currentErrorMessage = null;

    if (settings.historyEnabled) {
      yield* dependencies.database.transcripts.insert(transcriptWithInsertion);
    }

    return transcriptWithInsertion;
  });

export const registerIpcHandlers = (dependencies: IpcHandlerDependencies) => {
  void Effect.runPromise(
    Effect.gen(function* () {
      const settings = yield* getSettings(dependencies);
      state.settings = settings;
      state.setupComplete = Boolean(settings.activeModelId);
      yield* registerNativeHotkey(dependencies, settings.hotkey);
    }),
  );

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
  ipcMain.handle(IpcChannels.loadTranscriptAudio, (_event, input: unknown) =>
    Effect.runPromise(
      Effect.gen(function* () {
        yield* decodeIpcPayload(LoadTranscriptAudioRequest, input);

        return yield* Effect.fail(
          new Error(
            "Transcript audio loading is not available until transcript audio storage is initialized.",
          ),
        );
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
  ipcMain.handle(IpcChannels.showOverlayPreview, () =>
    Effect.runPromise(
      Effect.gen(function* () {
        yield* showOverlayPreview(dependencies);
        yield* publishAppState(dependencies);
      }),
    ),
  );
  ipcMain.handle(IpcChannels.commitOverlayPreviewPosition, (_event, input: unknown) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const point = yield* decodeIpcPayload(CommitOverlayPreviewPositionRequest, input);
        yield* commitOverlayPreviewPosition(dependencies, point);
        yield* publishAppState(dependencies);
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
                const model = getCatalog(dependencies).find(
                  (model) => model.id === installedProgress.modelId,
                );

                if (model) {
                  yield* recordInstalledModel(dependencies, model);
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
  ipcMain.handle(IpcChannels.installModelBundle, (_event, input: unknown) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const payload = yield* decodeIpcPayload(InstallModelBundleRequest, input);

        return yield* installModelBundle(dependencies, payload.modelId);
      }),
    ),
  );
  ipcMain.handle(IpcChannels.cancelModelInstall, (_event, input: unknown) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const payload = yield* decodeIpcPayload(CancelModelInstallRequest, input);

        yield* dependencies.modelInstallJob.cancel(payload.modelId);
        if (
          currentBundleInstallProgress?.modelId === payload.modelId &&
          currentBundleInstallProgress.runtimeId
        ) {
          yield* dependencies.runtimeInstallJob.cancel(
            currentBundleInstallProgress.runtimeId as RuntimeId,
          );
        }
        yield* publishAppState(dependencies);
      }),
    ),
  );
  ipcMain.handle(IpcChannels.refreshModelReadiness, () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const cache =
          dependencies.whisperCppRuntimeReadinessCache ?? defaultWhisperCppRuntimeReadinessCache;

        cache.clear();
        yield* publishAppState(dependencies);
      }),
    ),
  );
  ipcMain.handle(IpcChannels.getAppleIntelligenceAvailability, () =>
    Effect.runPromise(
      dependencies.appleIntelligence?.getAvailability() ??
        Effect.succeed({
          status: "device-not-eligible" as const,
          reason: "Apple Intelligence is only available on supported macOS devices.",
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
  ipcMain.handle(IpcChannels.stopTestDictation, (_event, input: unknown) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const submittedAudio = yield* Effect.try({
          try: () => decodeStopTestDictationInput(input),
          catch: (error) => (error instanceof Error ? error : new Error(String(error))),
        });
        const transcript = yield* stopTestDictation(dependencies, submittedAudio).pipe(
          Effect.tapError((error) =>
            Effect.gen(function* () {
              currentErrorMessage = error.message;
              state.overlayState = "error";
              yield* publishAppState(dependencies);
            }),
          ),
          Effect.ensuring(Effect.sync(() => hotkeyCoordinator.processingFinished())),
        );
        yield* publishAppState(dependencies);

        return transcript;
      }),
    ),
  );
};
