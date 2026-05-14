import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { createWhisperKitTranscriptionProvider } from "./whisperkit-provider";

describe("createWhisperKitTranscriptionProvider", () => {
  it("transcribes through the injected bridge", async () => {
    const provider = createWhisperKitTranscriptionProvider({
      bridge: {
        transcribe: async (request) => ({
          text: `${request.modelPath}:${request.audioPath}`,
          language: request.language === "ru" ? "ru" : "en",
          durationInSeconds: 1.5,
          warnings: ["warning"],
        }),
      },
    });

    await expect(
      Effect.runPromise(
        provider.transcribe({
          audioPath: "/tmp/audio.wav",
          language: "ru",
          modelId: "whisperkit-small",
          runtime: "whisperkit",
          installedModelPath: "/models/whisperkit-small",
          runtimeBinaryPath: null,
        }),
      ),
    ).resolves.toEqual({
      text: "/models/whisperkit-small:/tmp/audio.wav",
      language: "ru",
      durationInSeconds: 1.5,
      warnings: ["warning"],
    });
  });

  it("requires an installed model path", async () => {
    const provider = createWhisperKitTranscriptionProvider({
      bridge: {
        transcribe: async () => {
          throw new Error("should not run");
        },
      },
    });

    await expect(
      Effect.runPromise(
        provider.transcribe({
          audioPath: "/tmp/audio.wav",
          language: "en",
          modelId: "whisperkit-small",
          runtime: "whisperkit",
          installedModelPath: null,
          runtimeBinaryPath: null,
        }),
      ),
    ).rejects.toThrow("model_not_installed");
  });
});
