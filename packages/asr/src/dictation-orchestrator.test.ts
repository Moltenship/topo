import type { AudioCaptureService, CapturedAudio } from "@topo/audio";
import { createMockAudioCaptureService } from "@topo/audio";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { createDictationOrchestrator } from "./dictation-orchestrator";
import { PostProcessingError } from "./post-processing-provider";
import type { TranscriptionInput } from "./transcription-provider";
import { createMockTranscriptionProvider } from "./transcription-provider";

describe("createDictationOrchestrator", () => {
  it("records, transcribes, normalizes, and returns a transcript record", async () => {
    const ids = ["session_1", "transcript_1"];
    let transcriptionInput: TranscriptionInput | null = null;
    const orchestrator = createDictationOrchestrator({
      audio: createMockAudioCaptureService(),
      transcription: {
        transcribe: (input) => {
          transcriptionInput = input;
          return createMockTranscriptionProvider().transcribe(input);
        },
      },
      now: () => new Date("2026-05-07T00:00:00.000Z"),
      createId: () => ids.shift() ?? "fallback",
    });

    const transcript = await Effect.runPromise(
      Effect.gen(function* () {
        yield* orchestrator.start();
        return yield* orchestrator.stop({
          language: "en",
          modelId: "whisper-cpp-small",
          runtime: "whisper-cpp",
          installedModelPath: "C:\\models\\ggml-small.bin",
          runtimeBinaryPath: "C:\\bin\\whisper-cli.exe",
          postProcessingMode: "lightweight",
          recordingMode: "toggle-to-talk",
        });
      }),
    );

    expect(transcript).toMatchObject({
      id: "transcript_1",
      text: "Hello world",
      createdAt: "2026-05-07T00:00:00.000Z",
      durationMs: 1200,
      insertionStatus: "skipped",
      recordingMode: "toggle-to-talk",
    });
    expect(transcriptionInput).toMatchObject({
      installedModelPath: "C:\\models\\ggml-small.bin",
      runtimeBinaryPath: "C:\\bin\\whisper-cli.exe",
    });
  });

  it("cleans up captured audio when transcription fails", async () => {
    const capturedAudio: CapturedAudio = {
      sessionId: "session_1",
      audioPath: "file:///tmp/session_1.wav",
      durationMs: 900,
    };
    const cleanedAudioPaths: string[] = [];
    const audio: AudioCaptureService = {
      startRecording: () => Effect.void,
      stopRecording: () => Effect.succeed(capturedAudio),
      cleanupCapturedAudio: (audio) =>
        Effect.sync(() => {
          cleanedAudioPaths.push(audio.audioPath);
        }),
      onLevelFrame: () => () => undefined,
    };
    const orchestrator = createDictationOrchestrator({
      audio,
      transcription: {
        transcribe: () => Effect.fail(new Error("transcription failed")),
      },
      now: () => new Date("2026-05-07T00:00:00.000Z"),
      createId: () => "session_1",
    });

    await Effect.runPromise(orchestrator.start());

    await expect(
      Effect.runPromise(
        orchestrator.stop({
          language: "en",
          modelId: "whisper-cpp-small",
          runtime: "whisper-cpp",
          installedModelPath: "C:\\models\\ggml-small.bin",
          runtimeBinaryPath: "C:\\bin\\whisper-cli.exe",
          postProcessingMode: "lightweight",
          recordingMode: "toggle-to-talk",
        }),
      ),
    ).rejects.toThrow("transcription failed");
    expect(cleanedAudioPaths).toEqual(["file:///tmp/session_1.wav"]);
  });

  it("keeps raw transcript text when post-processing fails", async () => {
    const orchestrator = createDictationOrchestrator({
      audio: createMockAudioCaptureService(),
      transcription: {
        transcribe: () =>
          Effect.succeed({
            text: "raw transcript",
            language: "en",
            durationInSeconds: 1.2,
            warnings: [],
          }),
      },
      postProcessing: {
        process: (input) =>
          Effect.fail(
            new PostProcessingError("provider_failed", "cleanup failed", input.rawTranscript),
          ),
      },
      now: () => new Date("2026-05-07T00:00:00.000Z"),
      createId: () => "session_1",
    });

    const transcript = await Effect.runPromise(
      Effect.gen(function* () {
        yield* orchestrator.start();
        return yield* orchestrator.stop({
          language: "en",
          modelId: "whisper-cpp-small",
          runtime: "whisper-cpp",
          installedModelPath: "C:\\models\\ggml-small.bin",
          runtimeBinaryPath: "C:\\bin\\whisper-cli.exe",
          postProcessingMode: "api",
          recordingMode: "toggle-to-talk",
        });
      }),
    );

    expect(transcript.text).toBe("raw transcript");
  });
});
