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
        topo: {
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
        topo: {
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
        topo: {
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

  it("adds --no-gpu when CPU accelerator is selected", async () => {
    const calls: Array<{ binaryPath: string; args: readonly string[] }> = [];
    const provider = createLocalAiSdkTranscriptionProvider({
      runner: async (command) => {
        calls.push(command);
        return {
          exitCode: 0,
          stdout: "cpu transcript",
          stderr: "",
        };
      },
    });

    await transcribe({
      model: provider.transcription("whisper-cpp-small"),
      audio: new Uint8Array([1, 2, 3]),
      maxRetries: 0,
      providerOptions: {
        topo: {
          language: "auto",
          accelerator: "cpu",
          installedModelPath: "C:\\models\\ggml-small.bin",
          runtimeBinaryPath: "C:\\bin\\whisper-cli.exe",
          audioPath: "C:\\audio\\session.wav",
        },
      },
    });

    expect(calls[0]?.args).toContain("--no-gpu");
  });

  it("retries once with CPU fallback when GPU transcription fails", async () => {
    const calls: Array<{ binaryPath: string; args: readonly string[] }> = [];
    const provider = createLocalAiSdkTranscriptionProvider({
      runner: async (command) => {
        calls.push(command);

        if (command.binaryPath === "C:\\bin\\whisper-cuda.exe") {
          return {
            exitCode: 1,
            stdout: "",
            stderr: "CUDA failed",
          };
        }

        return {
          exitCode: 0,
          stdout: "cpu fallback transcript",
          stderr: "",
        };
      },
    });

    const result = await transcribe({
      model: provider.transcription("whisper-cpp-small"),
      audio: new Uint8Array([1, 2, 3]),
      maxRetries: 0,
      providerOptions: {
        topo: {
          language: "auto",
          accelerator: "gpu",
          installedModelPath: "C:\\models\\ggml-small.bin",
          runtimeBinaryPath: "C:\\bin\\whisper-cuda.exe",
          fallbackRuntimeBinaryPath: "C:\\bin\\whisper-cpu.exe",
          audioPath: "C:\\audio\\session.wav",
        },
      },
    });

    expect(result.text).toBe("cpu fallback transcript");
    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({
      binaryPath: "C:\\bin\\whisper-cuda.exe",
    });
    expect(calls[1]).toMatchObject({
      binaryPath: "C:\\bin\\whisper-cpu.exe",
    });
    expect(calls[1]?.args).toContain("--no-gpu");
  });

  it("does not retry when CPU accelerator is selected", async () => {
    const calls: Array<{ binaryPath: string; args: readonly string[] }> = [];
    const provider = createLocalAiSdkTranscriptionProvider({
      runner: async (command) => {
        calls.push(command);
        return {
          exitCode: 1,
          stdout: "",
          stderr: "CPU failed",
        };
      },
    });

    await expect(
      transcribe({
        model: provider.transcription("whisper-cpp-small"),
        audio: new Uint8Array([1, 2, 3]),
        maxRetries: 0,
        providerOptions: {
          topo: {
            language: "auto",
            accelerator: "cpu",
            installedModelPath: "C:\\models\\ggml-small.bin",
            runtimeBinaryPath: "C:\\bin\\whisper-cpu.exe",
            fallbackRuntimeBinaryPath: "C:\\bin\\whisper-cpu-fallback.exe",
            audioPath: "C:\\audio\\session.wav",
          },
        },
      }),
    ).rejects.toMatchObject({
      code: "transcription_failed",
    });

    expect(calls).toHaveLength(1);
  });

  it("does not retry with CPU fallback after abort", async () => {
    const abortController = new AbortController();
    const calls: Array<{ binaryPath: string; args: readonly string[] }> = [];
    const provider = createLocalAiSdkTranscriptionProvider({
      runner: async (command) => {
        calls.push(command);
        abortController.abort();
        throw new LocalAiSdkTranscriptionError("transcription_failed");
      },
    });

    await expect(
      transcribe({
        model: provider.transcription("whisper-cpp-small"),
        audio: new Uint8Array([1, 2, 3]),
        abortSignal: abortController.signal,
        maxRetries: 0,
        providerOptions: {
          topo: {
            language: "auto",
            accelerator: "gpu",
            installedModelPath: "C:\\models\\ggml-small.bin",
            runtimeBinaryPath: "C:\\bin\\whisper-cuda.exe",
            fallbackRuntimeBinaryPath: "C:\\bin\\whisper-cpu.exe",
            audioPath: "C:\\audio\\session.wav",
          },
        },
      }),
    ).rejects.toMatchObject({
      code: "transcription_failed",
    });

    expect(calls).toHaveLength(1);
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
          topo: {
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
          topo: {
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
