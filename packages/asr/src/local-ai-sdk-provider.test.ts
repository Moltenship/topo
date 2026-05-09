import { experimental_transcribe as transcribe } from "ai";
import { describe, expect, it } from "vitest";
import { createLocalAiSdkTranscriptionProvider } from "./local-ai-sdk-provider";

describe("createLocalAiSdkTranscriptionProvider", () => {
  it("returns text when used through experimental_transcribe", async () => {
    const provider = createLocalAiSdkTranscriptionProvider({
      runner: async () => ({
        exitCode: 0,
        stdout: "hello from whisper\n",
        stderr: "",
      }),
    });

    const result = await transcribe({
      model: provider.transcription("whisper-cpp-small"),
      audio: new Uint8Array([1, 2, 3]),
      maxRetries: 0,
      providerOptions: {
        molten: {
          language: "auto",
          installedModelPath: "C:\\models\\ggml-small.bin",
          runtimeBinaryPath: "C:\\bin\\whisper-cli.exe",
          audioPath: "C:\\audio\\session.wav",
        },
      },
    });

    expect(result.text).toBe("hello from whisper");
  });

  it("passes model, audio, and language flags to whisper-cli", async () => {
    const calls: Array<{ binaryPath: string; args: readonly string[] }> = [];
    const provider = createLocalAiSdkTranscriptionProvider({
      runner: async (command) => {
        calls.push(command);
        return {
          exitCode: 0,
          stdout: "privet mir",
          stderr: "",
        };
      },
    });

    await transcribe({
      model: provider.transcription("whisper-cpp-small"),
      audio: new Uint8Array([1, 2, 3]),
      maxRetries: 0,
      providerOptions: {
        molten: {
          language: "ru",
          installedModelPath: "C:\\models\\ggml-small.bin",
          runtimeBinaryPath: "C:\\bin\\whisper-cli.exe",
          audioPath: "C:\\audio\\session.wav",
        },
      },
    });

    expect(calls).toEqual([
      {
        binaryPath: "C:\\bin\\whisper-cli.exe",
        args: [
          "-m",
          "C:\\models\\ggml-small.bin",
          "-f",
          "C:\\audio\\session.wav",
          "-otxt",
          "-np",
          "-l",
          "ru",
        ],
      },
    ]);
  });
});
