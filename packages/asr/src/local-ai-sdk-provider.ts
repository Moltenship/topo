import { spawn } from "node:child_process";
import type { TranscriptionModel } from "ai";

export type LocalAiSdkTranscriptionLanguage = "en" | "ru" | "auto";

export interface MoltenTranscriptionModelOptions {
  readonly language?: LocalAiSdkTranscriptionLanguage | null;
  readonly installedModelPath?: string | null;
  readonly runtimeBinaryPath?: string | null;
  readonly audioPath?: string | null;
}

interface ParsedMoltenTranscriptionModelOptions {
  readonly language: LocalAiSdkTranscriptionLanguage;
  readonly installedModelPath: string;
  readonly runtimeBinaryPath: string;
  readonly audioPath: string;
}

export interface WhisperCppRunnerCommand {
  readonly binaryPath: string;
  readonly args: readonly string[];
  readonly abortSignal?: AbortSignal;
}

export interface WhisperCppRunnerResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

export type WhisperCppRunner = (
  command: WhisperCppRunnerCommand,
) => Promise<WhisperCppRunnerResult>;

export interface LocalAiSdkTranscriptionProvider {
  readonly transcription: (modelId: string) => TranscriptionModel;
}

export type LocalAiSdkTranscriptionErrorCode =
  | "model_not_installed"
  | "runtime_missing"
  | "audio_path_missing"
  | "unsupported_language"
  | "transcription_failed";

export class LocalAiSdkTranscriptionError extends Error {
  readonly code: LocalAiSdkTranscriptionErrorCode;

  constructor(code: LocalAiSdkTranscriptionErrorCode, cause?: unknown) {
    super(code, { cause });
    this.name = "LocalAiSdkTranscriptionError";
    this.code = code;
  }
}

export const createLocalAiSdkTranscriptionProvider = ({
  runner = createWhisperCppRunner(),
}: {
  readonly runner?: WhisperCppRunner;
} = {}): LocalAiSdkTranscriptionProvider => ({
  transcription: (modelId) => ({
    specificationVersion: "v3",
    provider: "molten",
    modelId,
    doGenerate: async ({ abortSignal, providerOptions }) => {
      const options = parseMoltenOptions(providerOptions?.molten);
      const args = buildWhisperCppArgs(options);
      const command: WhisperCppRunnerCommand =
        abortSignal === undefined
          ? {
              binaryPath: options.runtimeBinaryPath,
              args,
            }
          : {
              binaryPath: options.runtimeBinaryPath,
              args,
              abortSignal,
            };
      const result = await runWhisperCpp(runner, command);
      const text = result.stdout.trim();

      if (text.length === 0) {
        throw new LocalAiSdkTranscriptionError("transcription_failed");
      }

      return {
        text,
        segments: [],
        language: options.language === "auto" ? undefined : options.language,
        durationInSeconds: undefined,
        warnings: [],
        response: {
          timestamp: new Date(),
          modelId,
          body: {
            stderr: result.stderr,
          },
        },
      };
    },
  }),
});

const parseMoltenOptions = (input: unknown): ParsedMoltenTranscriptionModelOptions => {
  const options = isRecord(input) ? input : {};
  const language = options.language ?? "auto";

  if (!isSupportedLanguage(language)) {
    throw new LocalAiSdkTranscriptionError("unsupported_language");
  }

  return {
    language,
    installedModelPath: requireString(options.installedModelPath, "model_not_installed"),
    runtimeBinaryPath: requireString(options.runtimeBinaryPath, "runtime_missing"),
    audioPath: requireString(options.audioPath, "audio_path_missing"),
  };
};

export const buildWhisperCppArgs = (
  options: ParsedMoltenTranscriptionModelOptions,
): readonly string[] => {
  const args = ["-m", options.installedModelPath, "-f", options.audioPath, "-otxt", "-np"];

  if (options.language !== "auto") {
    args.push("-l", options.language);
  }

  return args;
};

const runWhisperCpp = async (
  runner: WhisperCppRunner,
  command: WhisperCppRunnerCommand,
): Promise<WhisperCppRunnerResult> => {
  try {
    const result = await runner(command);

    if (result.exitCode !== 0) {
      throw new LocalAiSdkTranscriptionError("transcription_failed");
    }

    return result;
  } catch (error) {
    if (error instanceof LocalAiSdkTranscriptionError) {
      throw error;
    }

    throw new LocalAiSdkTranscriptionError("transcription_failed", error);
  }
};

const createWhisperCppRunner = (): WhisperCppRunner => (command) =>
  new Promise((resolve, reject) => {
    const child = spawn(command.binaryPath, command.args, {
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";

    const abort = () => {
      child.kill();
      reject(new LocalAiSdkTranscriptionError("transcription_failed"));
    };

    command.abortSignal?.addEventListener("abort", abort, { once: true });
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      command.abortSignal?.removeEventListener("abort", abort);
      reject(error);
    });
    child.on("close", (exitCode) => {
      command.abortSignal?.removeEventListener("abort", abort);
      resolve({
        exitCode: exitCode ?? 1,
        stdout,
        stderr,
      });
    });
  });

const requireString = (value: unknown, code: LocalAiSdkTranscriptionErrorCode): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new LocalAiSdkTranscriptionError(code);
  }

  return value;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isSupportedLanguage = (value: unknown): value is LocalAiSdkTranscriptionLanguage =>
  value === "en" || value === "ru" || value === "auto";
