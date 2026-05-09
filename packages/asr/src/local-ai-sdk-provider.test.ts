import { experimental_transcribe as transcribe } from "ai";
import { describe, expect, it } from "vitest";
import {
  createLocalAiSdkTranscriptionProvider,
  LocalAiSdkTranscriptionError,
} from "./local-ai-sdk-provider";

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

  it("removes whisper.cpp segment timestamps from stdout", async () => {
    const provider = createLocalAiSdkTranscriptionProvider({
      runner: async () => ({
        exitCode: 0,
        stdout:
          "[00:00:00.000 --> 00:00:06.680] I check how my voice works in this application.\n[00:00:06.680 --> 00:00:09.760] 123, my name is Timofey Maximov.\n",
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

    expect(result.text).toBe(
      "I check how my voice works in this application. 123, my name is Timofey Maximov.",
    );
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

  it("includes stderr and exit code when whisper-cli exits non-zero", async () => {
    const provider = createLocalAiSdkTranscriptionProvider({
      runner: async () => ({
        exitCode: 74,
        stdout: "partial diagnostic before failure",
        stderr: "failed to load model: invalid magic",
      }),
    });

    await expect(
      transcribe({
        model: provider.transcription("whisper-cpp-small"),
        audio: new Uint8Array([1, 2, 3]),
        maxRetries: 0,
        providerOptions: {
          molten: {
            language: "en",
            installedModelPath: "C:\\models\\ggml-small.bin",
            runtimeBinaryPath: "C:\\bin\\whisper-cli.exe",
            audioPath: "C:\\audio\\session.wav",
          },
        },
      }),
    ).rejects.toMatchObject({
      code: "transcription_failed",
      exitCode: 74,
      stderrExcerpt: "failed to load model: invalid magic",
      stdoutExcerpt: "partial diagnostic before failure",
      command: "C:\\bin\\whisper-cli.exe",
      modelId: "whisper-cpp-small",
      audioPath: "C:\\audio\\session.wav",
    } satisfies Partial<LocalAiSdkTranscriptionError>);
  });

  it("explains empty stdout when whisper.cpp produces no text", async () => {
    const provider = createLocalAiSdkTranscriptionProvider({
      runner: async () => ({
        exitCode: 0,
        stdout: " \n",
        stderr: "no speech detected",
      }),
    });

    await expect(
      transcribe({
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
      }),
    ).rejects.toThrow(/produced no text.*no speech detected/i);
  });
});
