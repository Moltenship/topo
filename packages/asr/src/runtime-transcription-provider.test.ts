import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { createRuntimeTranscriptionProvider } from "./runtime-transcription-provider";
import type { TranscriptionProvider } from "./transcription-provider";

const providerReturning = (text: string): TranscriptionProvider => ({
  transcribe: () =>
    Effect.succeed({
      text,
      language: "en",
      durationInSeconds: 1,
      warnings: [],
    }),
});

describe("createRuntimeTranscriptionProvider", () => {
  it("routes WhisperKit models to the WhisperKit provider", async () => {
    const provider = createRuntimeTranscriptionProvider({
      whisperCpp: providerReturning("cpp"),
      whisperKit: providerReturning("kit"),
    });

    await expect(
      Effect.runPromise(
        provider.transcribe({
          audioPath: "/tmp/audio.wav",
          language: "en",
          modelId: "whisperkit-small",
          runtime: "whisperkit",
          installedModelPath: "/models/whisperkit-small",
          runtimeBinaryPath: null,
        }),
      ),
    ).resolves.toMatchObject({ text: "kit" });
  });

  it("routes whisper.cpp models to the whisper.cpp provider", async () => {
    const provider = createRuntimeTranscriptionProvider({
      whisperCpp: providerReturning("cpp"),
      whisperKit: providerReturning("kit"),
    });

    await expect(
      Effect.runPromise(
        provider.transcribe({
          audioPath: "/tmp/audio.wav",
          language: "en",
          modelId: "whisper-cpp-small",
          runtime: "whisper-cpp",
          installedModelPath: "/models/whisper-cpp-small.bin",
          runtimeBinaryPath: "/bin/whisper-cli",
        }),
      ),
    ).resolves.toMatchObject({ text: "cpp" });
  });
});
