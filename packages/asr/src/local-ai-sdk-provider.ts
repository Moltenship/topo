import { spawn } from "node:child_process";
import type { TranscriptionModel } from "ai";

export type LocalAiSdkTranscriptionLanguage = "en" | "ru" | "auto";

export interface TopoTranscriptionModelOptions {
  readonly language?: LocalAiSdkTranscriptionLanguage | null;
  readonly installedModelPath?: string | null;
  readonly runtimeBinaryPath?: string | null;
  readonly fallbackRuntimeBinaryPath?: string | null;
  readonly accelerator?: "auto" | "cpu" | "gpu" | null;
  readonly audioPath?: string | null;
}

interface ParsedTopoTranscriptionModelOptions {
  readonly language: LocalAiSdkTranscriptionLanguage;
  readonly installedModelPath: string;
  readonly runtimeBinaryPath: string;
  readonly fallbackRuntimeBinaryPath: string | null;
  readonly accelerator: "auto" | "cpu" | "gpu";
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

interface LocalAiSdkTranscriptionErrorDetails {
  readonly reason?: string;
  readonly exitCode?: number;
  readonly stderr?: string;
  readonly stdout?: string;
  readonly command?: string;
  readonly args?: readonly string[];
  readonly modelId?: string;
  readonly audioPath?: string;
  readonly installedModelPath?: string;
  readonly cause?: unknown;
}

export class LocalAiSdkTranscriptionError extends Error {
  readonly code: LocalAiSdkTranscriptionErrorCode;
  readonly exitCode: number | undefined;
  readonly stderrExcerpt: string | undefined;
  readonly stdoutExcerpt: string | undefined;
  readonly command: string | undefined;
  readonly args: readonly string[] | undefined;
  readonly modelId: string | undefined;
  readonly audioPath: string | undefined;
  readonly installedModelPath: string | undefined;

  constructor(
    code: LocalAiSdkTranscriptionErrorCode,
    details: LocalAiSdkTranscriptionErrorDetails = {},
  ) {
    super(formatErrorMessage(code, details), { cause: details.cause });
    this.name = "LocalAiSdkTranscriptionError";
    this.code = code;
    this.exitCode = details.exitCode;
    this.stderrExcerpt = excerpt(details.stderr);
    this.stdoutExcerpt = excerpt(details.stdout);
    this.command = details.command;
    this.args = details.args;
    this.modelId = details.modelId;
    this.audioPath = details.audioPath;
    this.installedModelPath = details.installedModelPath;
  }
}

export const createLocalAiSdkTranscriptionProvider = ({
  runner = createWhisperCppRunner(),
}: {
  readonly runner?: WhisperCppRunner;
} = {}): LocalAiSdkTranscriptionProvider => ({
  transcription: (modelId) => ({
    specificationVersion: "v3",
    provider: "topo",
    modelId,
    doGenerate: async ({ abortSignal, providerOptions }) => {
      const options = parseTopoOptions(providerOptions?.topo);
      const args = buildWhisperCppArgs(options);
      const command =
        abortSignal === undefined
          ? createRunnerCommand({
              binaryPath: options.runtimeBinaryPath,
              args,
            })
          : createRunnerCommand({
              binaryPath: options.runtimeBinaryPath,
              args,
              abortSignal,
            });
      const { result, usedFallback } = await runWhisperCppWithFallback(runner, command, options, {
        modelId,
        audioPath: options.audioPath,
        installedModelPath: options.installedModelPath,
      });
      const text = parseWhisperCppText(result.stdout);

      if (text.length === 0) {
        throw new LocalAiSdkTranscriptionError("transcription_failed", {
          reason: "whisper.cpp produced no text",
          exitCode: result.exitCode,
          stderr: result.stderr,
          stdout: result.stdout,
          command: command.binaryPath,
          args: command.args,
          modelId,
          audioPath: options.audioPath,
          installedModelPath: options.installedModelPath,
        });
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
            accelerator: usedFallback ? "cpu-fallback" : options.accelerator,
          },
        },
      };
    },
  }),
});

const parseTopoOptions = (input: unknown): ParsedTopoTranscriptionModelOptions => {
  const options = isRecord(input) ? input : {};
  const language = options.language ?? "auto";

  if (!isSupportedLanguage(language)) {
    throw new LocalAiSdkTranscriptionError("unsupported_language");
  }

  return {
    language,
    installedModelPath: requireString(options.installedModelPath, "model_not_installed"),
    runtimeBinaryPath: requireString(options.runtimeBinaryPath, "runtime_missing"),
    fallbackRuntimeBinaryPath: optionalString(options.fallbackRuntimeBinaryPath),
    accelerator: isSupportedAccelerator(options.accelerator) ? options.accelerator : "auto",
    audioPath: requireString(options.audioPath, "audio_path_missing"),
  };
};

export const buildWhisperCppArgs = (
  options: ParsedTopoTranscriptionModelOptions,
): readonly string[] => {
  const args = ["-m", options.installedModelPath, "-f", options.audioPath, "-otxt", "-np"];

  if (options.language !== "auto") {
    args.push("-l", options.language);
  }

  if (options.accelerator === "cpu") {
    args.push("--no-gpu");
  }

  return args;
};

export const parseWhisperCppText = (stdout: string): string =>
  stdout
    .split(/\r?\n/)
    .map((line) =>
      line.replace(/^\s*\[\d{2}:\d{2}:\d{2}\.\d{3}\s+-->\s+\d{2}:\d{2}:\d{2}\.\d{3}\]\s*/, ""),
    )
    .join(" ")
    .trim()
    .replace(/\s+/g, " ");

const runWhisperCppWithFallback = async (
  runner: WhisperCppRunner,
  command: WhisperCppRunnerCommand,
  options: ParsedTopoTranscriptionModelOptions,
  context: Pick<
    LocalAiSdkTranscriptionErrorDetails,
    "audioPath" | "installedModelPath" | "modelId"
  >,
): Promise<{ readonly result: WhisperCppRunnerResult; readonly usedFallback: boolean }> => {
  try {
    const result = await runWhisperCpp(runner, command, context);

    return { result, usedFallback: false };
  } catch (error) {
    if (!shouldRetryWithCpuFallback(error, command.abortSignal, options)) {
      throw error;
    }

    const fallbackRuntimeBinaryPath = options.fallbackRuntimeBinaryPath;

    if (fallbackRuntimeBinaryPath === null) {
      throw error;
    }

    const fallbackCommand = createRunnerCommand({
      binaryPath: fallbackRuntimeBinaryPath,
      args: buildWhisperCppArgs({ ...options, accelerator: "cpu" }),
      ...(command.abortSignal === undefined ? {} : { abortSignal: command.abortSignal }),
    });
    const result = await runWhisperCpp(runner, fallbackCommand, context);

    return { result, usedFallback: true };
  }
};

const runWhisperCpp = async (
  runner: WhisperCppRunner,
  command: WhisperCppRunnerCommand,
  context: Pick<
    LocalAiSdkTranscriptionErrorDetails,
    "audioPath" | "installedModelPath" | "modelId"
  >,
): Promise<WhisperCppRunnerResult> => {
  try {
    const result = await runner(command);

    if (result.exitCode !== 0) {
      throw new LocalAiSdkTranscriptionError("transcription_failed", {
        reason: "whisper.cpp exited with a non-zero status",
        exitCode: result.exitCode,
        stderr: result.stderr,
        stdout: result.stdout,
        command: command.binaryPath,
        args: command.args,
        ...context,
      });
    }

    return result;
  } catch (error) {
    if (error instanceof LocalAiSdkTranscriptionError) {
      throw error;
    }

    throw new LocalAiSdkTranscriptionError("transcription_failed", {
      reason: "failed to execute whisper.cpp",
      command: command.binaryPath,
      args: command.args,
      cause: error,
      ...context,
    });
  }
};

const shouldRetryWithCpuFallback = (
  error: unknown,
  abortSignal: AbortSignal | undefined,
  options: ParsedTopoTranscriptionModelOptions,
): boolean =>
  error instanceof LocalAiSdkTranscriptionError &&
  !abortSignal?.aborted &&
  options.accelerator !== "cpu" &&
  options.fallbackRuntimeBinaryPath !== null &&
  options.fallbackRuntimeBinaryPath !== options.runtimeBinaryPath;

const createRunnerCommand = ({
  binaryPath,
  args,
  abortSignal,
}: {
  readonly binaryPath: string;
  readonly args: readonly string[];
  readonly abortSignal?: AbortSignal;
}): WhisperCppRunnerCommand =>
  abortSignal === undefined
    ? {
        binaryPath,
        args,
      }
    : {
        binaryPath,
        args,
        abortSignal,
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

const optionalString = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isSupportedLanguage = (value: unknown): value is LocalAiSdkTranscriptionLanguage =>
  value === "en" || value === "ru" || value === "auto";

const isSupportedAccelerator = (value: unknown): value is "auto" | "cpu" | "gpu" =>
  value === "auto" || value === "cpu" || value === "gpu";

const excerpt = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();

  if (trimmed === undefined || trimmed.length === 0) {
    return undefined;
  }

  return trimmed.length > 500 ? `${trimmed.slice(0, 500)}...` : trimmed;
};

const formatErrorMessage = (
  code: LocalAiSdkTranscriptionErrorCode,
  details: LocalAiSdkTranscriptionErrorDetails,
): string => {
  if (code !== "transcription_failed") {
    return code;
  }

  const parts = [
    code,
    details.reason,
    details.exitCode === undefined ? undefined : `exitCode=${details.exitCode}`,
    details.command === undefined ? undefined : `command=${details.command}`,
    details.modelId === undefined ? undefined : `modelId=${details.modelId}`,
    details.audioPath === undefined ? undefined : `audioPath=${details.audioPath}`,
    details.installedModelPath === undefined
      ? undefined
      : `installedModelPath=${details.installedModelPath}`,
    details.args === undefined ? undefined : `args=${details.args.join(" ")}`,
    withLabel("stderr", excerpt(details.stderr)),
    withLabel("stdout", excerpt(details.stdout)),
  ].filter((part): part is string => part !== undefined);

  return parts.join("; ");
};

const withLabel = (label: string, value: string | undefined): string | undefined =>
  value === undefined ? undefined : `${label}=${value}`;
