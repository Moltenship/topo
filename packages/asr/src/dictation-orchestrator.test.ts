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
          postProcessingPrompt: "Clean the transcript.",
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
          postProcessingPrompt: "Clean the transcript.",
          recordingMode: "toggle-to-talk",
        }),
      ),
    ).rejects.toThrow("transcription failed");
    expect(cleanedAudioPaths).toEqual(["file:///tmp/session_1.wav"]);
  });

  it("attaches preserved audio metadata before cleaning up captured audio", async () => {
    const cleanupCalls: string[] = [];
    const orchestrator = createDictationOrchestrator({
      audio: {
        startRecording: () => Effect.void,
        stopRecording: () =>
          Effect.succeed({
            sessionId: "session_1",
            audioPath: "/tmp/topo-capture.wav",
            durationMs: 1200,
          }),
        cleanupCapturedAudio: (audio) =>
          Effect.sync(() => {
            cleanupCalls.push(audio.audioPath);
          }),
        onLevelFrame: () => () => undefined,
      },
      transcription: {
        transcribe: () =>
          Effect.succeed({
            text: "hello",
            language: "en",
            durationInSeconds: 1.2,
            warnings: [],
          }),
      },
      postProcessing: {
        process: ({ rawTranscript }) => Effect.succeed({ text: rawTranscript, warning: null }),
      },
      now: () => new Date("2026-05-15T00:00:00.000Z"),
      createId: () => "tr_audio",
    });

    await Effect.runPromise(orchestrator.start());
    const transcript = await Effect.runPromise(
      orchestrator.stop({
        language: "en",
        modelId: "whisper-cpp-small",
        runtime: "whisper-cpp",
        installedModelPath: "/models/model.bin",
        runtimeBinaryPath: "/bin/whisper-cli",
        postProcessingMode: "raw",
        postProcessingPrompt: "Clean the transcript.",
        recordingMode: "toggle-to-talk",
        preserveCapturedAudio: ({ transcriptId, audioPath }) => {
          expect(cleanupCalls).toEqual([]);

          return Effect.succeed({
            audioFileName: `${transcriptId}.wav`,
            audioMimeType: "audio/wav",
            audioByteSize: audioPath.length,
          });
        },
      }),
    );

    expect(transcript.audioFileName).toBe("tr_audio.wav");
    expect(transcript.audioMimeType).toBe("audio/wav");
    expect(transcript.audioByteSize).toBe("/tmp/topo-capture.wav".length);
    expect(cleanupCalls).toEqual(["/tmp/topo-capture.wav"]);
  });

  it("keeps transcript text and reports an observer error when audio preservation fails", async () => {
    const cleanupCalls: string[] = [];
    const preservationErrors: string[] = [];
    const orchestrator = createDictationOrchestrator({
      audio: {
        startRecording: () => Effect.void,
        stopRecording: () =>
          Effect.succeed({
            sessionId: "session_1",
            audioPath: "/tmp/topo-capture.wav",
            durationMs: 1200,
          }),
        cleanupCapturedAudio: (audio) =>
          Effect.sync(() => {
            cleanupCalls.push(audio.audioPath);
          }),
        onLevelFrame: () => () => undefined,
      },
      transcription: {
        transcribe: () =>
          Effect.succeed({
            text: "hello",
            language: "en",
            durationInSeconds: 1.2,
            warnings: [],
          }),
      },
      now: () => new Date("2026-05-15T00:00:00.000Z"),
      createId: () => "tr_audio",
    });

    await Effect.runPromise(orchestrator.start());
    const transcript = await Effect.runPromise(
      orchestrator.stop({
        language: "en",
        modelId: "whisper-cpp-small",
        runtime: "whisper-cpp",
        installedModelPath: "/models/model.bin",
        runtimeBinaryPath: "/bin/whisper-cli",
        postProcessingMode: "raw",
        postProcessingPrompt: "Clean the transcript.",
        recordingMode: "toggle-to-talk",
        preserveCapturedAudio: () => Effect.fail(new Error("copy failed")),
        onPreserveCapturedAudioError: (error) =>
          Effect.sync(() => {
            preservationErrors.push(error.message);
          }),
      }),
    );

    expect(transcript.text).toBe("hello");
    expect(transcript.audioFileName).toBeNull();
    expect(transcript.audioMimeType).toBeNull();
    expect(transcript.audioByteSize).toBeNull();
    expect(preservationErrors).toEqual(["copy failed"]);
    expect(cleanupCalls).toEqual(["/tmp/topo-capture.wav"]);
  });

  it("clears the active session after a failed stop attempt", async () => {
    const ids = ["session_1", "session_2"];
    const orchestrator = createDictationOrchestrator({
      audio: createMockAudioCaptureService(),
      transcription: {
        transcribe: () => Effect.fail(new Error("transcription failed")),
      },
      now: () => new Date("2026-05-15T00:00:00.000Z"),
      createId: () => ids.shift() ?? "tr_audio",
    });

    await expect(Effect.runPromise(orchestrator.start())).resolves.toBe("session_1");
    await expect(
      Effect.runPromise(
        orchestrator.stop({
          language: "en",
          modelId: "whisper-cpp-small",
          runtime: "whisper-cpp",
          installedModelPath: "/models/model.bin",
          runtimeBinaryPath: "/bin/whisper-cli",
          postProcessingMode: "raw",
          postProcessingPrompt: "Clean the transcript.",
          recordingMode: "toggle-to-talk",
        }),
      ),
    ).rejects.toThrow("transcription failed");
    await expect(Effect.runPromise(orchestrator.start())).resolves.toBe("session_2");
  });

  it("skips audio preservation when the preservation predicate rejects the transcript", async () => {
    let preserveCalls = 0;
    const orchestrator = createDictationOrchestrator({
      audio: createMockAudioCaptureService(),
      transcription: {
        transcribe: () =>
          Effect.succeed({
            text: "   ",
            language: "en",
            durationInSeconds: 1.2,
            warnings: [],
          }),
      },
      now: () => new Date("2026-05-15T00:00:00.000Z"),
      createId: () => "tr_audio",
    });

    await Effect.runPromise(orchestrator.start());
    const transcript = await Effect.runPromise(
      orchestrator.stop({
        language: "en",
        modelId: "whisper-cpp-small",
        runtime: "whisper-cpp",
        installedModelPath: "/models/model.bin",
        runtimeBinaryPath: "/bin/whisper-cli",
        postProcessingMode: "raw",
        postProcessingPrompt: "Clean the transcript.",
        recordingMode: "toggle-to-talk",
        shouldPreserveCapturedAudio: ({ text }) => text.trim().length > 0,
        preserveCapturedAudio: () =>
          Effect.sync(() => {
            preserveCalls += 1;
            return {
              audioFileName: "tr_audio.wav",
              audioMimeType: "audio/wav",
              audioByteSize: 4,
            };
          }),
      }),
    );

    expect(preserveCalls).toBe(0);
    expect(transcript.audioFileName).toBeNull();
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
          postProcessingPrompt: "Clean the transcript.",
          recordingMode: "toggle-to-talk",
        });
      }),
    );

    expect(transcript.text).toBe("raw transcript");
  });
});
