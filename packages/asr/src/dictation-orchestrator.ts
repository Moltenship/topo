import type { AudioCaptureService } from "@topo/audio";
import type { LanguageCode, RecordingMode, TranscriptRecord } from "@topo/shared";
import { Effect } from "effect";
import type { PostProcessingMode } from "./post-processing";
import {
  createLightweightPostProcessingProvider,
  type PostProcessingProvider,
} from "./post-processing-provider";
import type { TranscriptionProvider } from "./transcription-provider";

export interface DictationOrchestratorDependencies {
  readonly audio: AudioCaptureService;
  readonly transcription: TranscriptionProvider;
  readonly postProcessing?: PostProcessingProvider;
  readonly now: () => Date;
  readonly createId: () => string;
}

export interface DictationOrchestrator {
  readonly start: () => Effect.Effect<string>;
  readonly stop: (input: {
    readonly language: LanguageCode;
    readonly modelId: string;
    readonly runtime: string;
    readonly installedModelPath: string;
    readonly runtimeBinaryPath: string | null;
    readonly postProcessingMode: PostProcessingMode;
    readonly recordingMode: RecordingMode;
  }) => Effect.Effect<TranscriptRecord, Error>;
}

export const createDictationOrchestrator = (
  dependencies: DictationOrchestratorDependencies,
): DictationOrchestrator => {
  let sessionId: string | null = null;
  const postProcessing = dependencies.postProcessing ?? createLightweightPostProcessingProvider();

  return {
    start: () =>
      Effect.gen(function* () {
        sessionId = dependencies.createId();
        yield* dependencies.audio.startRecording(sessionId);
        return sessionId;
      }),
    stop: (input) =>
      Effect.gen(function* () {
        if (sessionId === null) {
          return yield* Effect.fail(new Error("No active dictation session"));
        }

        const audio = yield* dependencies.audio.stopRecording("hotkey-release");
        const result = yield* Effect.acquireUseRelease(
          Effect.succeed(audio),
          (capturedAudio) =>
            dependencies.transcription.transcribe({
              audioPath: capturedAudio.audioPath,
              language: input.language,
              modelId: input.modelId,
              runtime: input.runtime,
              installedModelPath: input.installedModelPath,
              runtimeBinaryPath: input.runtimeBinaryPath,
            }),
          (capturedAudio) =>
            Effect.catchAll(
              dependencies.audio.cleanupCapturedAudio(capturedAudio),
              () => Effect.void,
            ),
        );

        sessionId = null;

        const processed =
          input.postProcessingMode === "raw"
            ? { text: result.text, warning: null }
            : yield* postProcessing
                .process({
                  rawTranscript: result.text,
                  language: result.language,
                  promptId: "default-cleanup",
                  providerId: getPostProcessingProviderId(input.postProcessingMode),
                  modelId: getPostProcessingModelId(input.postProcessingMode),
                  targetSchema: "plain-text",
                })
                .pipe(Effect.catchAll((error) => Effect.succeed(error.recoverableResult)));

        return {
          id: dependencies.createId(),
          text: processed.text,
          createdAt: dependencies.now().toISOString(),
          durationMs: audio.durationMs,
          modelId: input.modelId,
          runtime: input.runtime,
          language: result.language,
          recordingMode: input.recordingMode,
          stopReason: "hotkey-release",
          insertionMode: "paste",
          insertionStatus: "skipped",
          targetAppName: null,
        };
      }),
  };
};

const getPostProcessingProviderId = (mode: PostProcessingMode) => {
  if (mode === "apple-intelligence") {
    return "apple-intelligence";
  }

  if (mode === "api") {
    return "openai";
  }

  return "lightweight";
};

const getPostProcessingModelId = (mode: PostProcessingMode) => {
  if (mode === "apple-intelligence") {
    return "default";
  }

  if (mode === "api") {
    return "configured";
  }

  return "local";
};
