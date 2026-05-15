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

export interface PreservedCapturedAudioMetadata {
  readonly audioFileName: string;
  readonly audioMimeType: string;
  readonly audioByteSize: number;
}

export interface DictationOrchestrator {
  readonly start: () => Effect.Effect<string>;
  readonly stop: (input: {
    readonly language: LanguageCode;
    readonly modelId: string;
    readonly runtime: string;
    readonly installedModelPath: string;
    readonly runtimeBinaryPath: string | null;
    readonly fallbackRuntimeBinaryPath?: string | null;
    readonly accelerator?: "auto" | "cpu" | "gpu" | null;
    readonly postProcessingMode: PostProcessingMode;
    readonly postProcessingPrompt: string;
    readonly recordingMode: RecordingMode;
    readonly preserveCapturedAudio?: (input: {
      readonly transcriptId: string;
      readonly audioPath: string;
    }) => Effect.Effect<PreservedCapturedAudioMetadata, Error>;
    readonly onPreserveCapturedAudioError?: (error: Error) => Effect.Effect<void>;
    readonly shouldPreserveCapturedAudio?: (input: { readonly text: string }) => boolean;
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

        return yield* Effect.gen(function* () {
          const audio = yield* dependencies.audio.stopRecording("hotkey-release");
          const transcript = yield* Effect.acquireUseRelease(
            Effect.succeed(audio),
            (capturedAudio) =>
              Effect.gen(function* () {
                const result = yield* dependencies.transcription.transcribe({
                  audioPath: capturedAudio.audioPath,
                  language: input.language,
                  modelId: input.modelId,
                  runtime: input.runtime,
                  installedModelPath: input.installedModelPath,
                  runtimeBinaryPath: input.runtimeBinaryPath,
                  fallbackRuntimeBinaryPath: input.fallbackRuntimeBinaryPath ?? null,
                  accelerator: input.accelerator ?? null,
                });

                const processed =
                  input.postProcessingMode === "raw"
                    ? { text: result.text, warning: null }
                    : yield* postProcessing
                        .process({
                          rawTranscript: result.text,
                          language: result.language,
                          promptId: "default-cleanup",
                          prompt: input.postProcessingPrompt,
                          providerId: getPostProcessingProviderId(input.postProcessingMode),
                          modelId: getPostProcessingModelId(input.postProcessingMode),
                          targetSchema: "plain-text",
                        })
                        .pipe(Effect.catchAll((error) => Effect.succeed(error.recoverableResult)));
                const transcriptId = dependencies.createId();
                const shouldPreserveAudio =
                  input.shouldPreserveCapturedAudio?.({ text: processed.text }) ?? true;
                const preservedAudio =
                  input.preserveCapturedAudio && shouldPreserveAudio
                    ? yield* input
                        .preserveCapturedAudio({
                          transcriptId,
                          audioPath: capturedAudio.audioPath,
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
                const transcript: TranscriptRecord = {
                  id: transcriptId,
                  text: processed.text,
                  createdAt: dependencies.now().toISOString(),
                  durationMs: capturedAudio.durationMs,
                  modelId: input.modelId,
                  runtime: input.runtime,
                  language: result.language,
                  recordingMode: input.recordingMode,
                  stopReason: "hotkey-release",
                  insertionMode: "paste",
                  insertionStatus: "skipped",
                  targetAppName: null,
                  audioFileName: preservedAudio?.audioFileName ?? null,
                  audioMimeType: preservedAudio?.audioMimeType ?? null,
                  audioByteSize: preservedAudio?.audioByteSize ?? null,
                };

                return transcript;
              }),
            (capturedAudio) =>
              Effect.catchAll(
                dependencies.audio.cleanupCapturedAudio(capturedAudio),
                () => Effect.void,
              ),
          );

          return transcript;
        }).pipe(
          Effect.ensuring(
            Effect.sync(() => {
              sessionId = null;
            }),
          ),
        );
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
