import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { createWhisperCppTranscriptionProvider } from "./whisper-cpp-provider";

describe("createWhisperCppTranscriptionProvider", () => {
  it("fails with runtime_missing when runtimeBinaryPath is missing", async () => {
    const provider = createWhisperCppTranscriptionProvider({
      runner: async () => ({
        exitCode: 0,
        stdout: "hello",
        stderr: "",
      }),
    });

    await expect(
      Effect.runPromise(
        provider.transcribe({
          audioPath: "C:\\audio\\session.wav",
          language: "en",
          modelId: "whisper-cpp-small",
          installedModelPath: "C:\\models\\ggml-small.bin",
        }),
      ),
    ).rejects.toThrow("runtime_missing");
  });

  it("fails with model_not_installed when installedModelPath is missing", async () => {
    const provider = createWhisperCppTranscriptionProvider({
      runner: async () => ({
        exitCode: 0,
        stdout: "hello",
        stderr: "",
      }),
    });

    await expect(
      Effect.runPromise(
        provider.transcribe({
          audioPath: "C:\\audio\\session.wav",
          language: "en",
          modelId: "whisper-cpp-small",
          runtimeBinaryPath: "C:\\bin\\whisper-cli.exe",
        }),
      ),
    ).rejects.toThrow("model_not_installed");
  });
});
