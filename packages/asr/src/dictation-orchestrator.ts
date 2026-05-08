import type { AudioCaptureService } from "@molten-voice/audio";
import type { LanguageCode, TranscriptRecord } from "@molten-voice/shared";
import { Effect } from "effect";
import { normalizeTranscript, type PostProcessingMode } from "./post-processing";
import type { TranscriptionProvider } from "./transcription-provider";

export interface DictationOrchestratorDependencies {
  readonly audio: AudioCaptureService;
  readonly transcription: TranscriptionProvider;
  readonly now: () => Date;
  readonly createId: () => string;
}

export interface DictationOrchestrator {
  readonly start: () => Effect.Effect<string>;
  readonly stop: (input: {
    readonly language: LanguageCode;
    readonly modelId: string;
    readonly runtime: string;
    readonly postProcessingMode: PostProcessingMode;
  }) => Effect.Effect<TranscriptRecord, Error>;
}

export const createDictationOrchestrator = (
  dependencies: DictationOrchestratorDependencies,
): DictationOrchestrator => {
  let sessionId: string | null = null;

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
            }),
          (capturedAudio) =>
            Effect.catchAll(
              dependencies.audio.cleanupCapturedAudio(capturedAudio),
              () => Effect.void,
            ),
        );

        sessionId = null;

        return {
          id: dependencies.createId(),
          text: normalizeTranscript(result.text, input.postProcessingMode),
          createdAt: dependencies.now().toISOString(),
          durationMs: audio.durationMs,
          modelId: input.modelId,
          runtime: input.runtime,
          language: result.language,
          recordingMode: "push-to-talk",
          stopReason: "hotkey-release",
          insertionMode: "paste",
          insertionStatus: "skipped",
          targetAppName: null,
        };
      }),
  };
};
