import { app } from "electron";
import { access } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { Effect } from "effect";
import type {
  WhisperKitTranscriptionBridge,
  WhisperKitTranscriptionRequest,
  WhisperKitTranscriptionResult,
} from "@topo/asr";

export interface WhisperKitAvailability {
  readonly status: "available" | "missing";
  readonly reason: string;
}

interface HelperResponse {
  readonly success: boolean;
  readonly reason: string;
  readonly text?: string;
  readonly language?: "en" | "ru";
  readonly durationInSeconds?: number;
  readonly warnings?: readonly string[];
}

interface HelperRunner {
  readonly run: (command: "probe" | "transcribe", input?: unknown) => Promise<HelperResponse>;
}

export interface WhisperKitBridge extends WhisperKitTranscriptionBridge {
  readonly getAvailability: () => Effect.Effect<WhisperKitAvailability, never>;
}

export const createWhisperKitBridge = ({
  runner = createSwiftPackageHelperRunner(),
}: {
  readonly runner?: HelperRunner;
} = {}): WhisperKitBridge => ({
  getAvailability: () =>
    Effect.tryPromise({
      try: async () => {
        const response = await runner.run("probe");

        return response.success
          ? { status: "available" as const, reason: response.reason }
          : { status: "missing" as const, reason: response.reason };
      },
      catch: (error) => (error instanceof Error ? error : new Error(String(error))),
    }).pipe(
      Effect.catchAll((error) =>
        Effect.succeed({
          status: "missing" as const,
          reason: error.message,
        }),
      ),
    ),
  transcribe: async (
    request: WhisperKitTranscriptionRequest,
  ): Promise<WhisperKitTranscriptionResult> => {
    const response = await runner.run("transcribe", request);

    if (!response.success || !response.text) {
      throw new Error(response.reason);
    }

    return {
      text: response.text,
      language: response.language ?? "en",
      durationInSeconds: response.durationInSeconds ?? 0,
      warnings: response.warnings ?? [],
    };
  },
});

const createSwiftPackageHelperRunner = (): HelperRunner => {
  let helperPathPromise: Promise<string> | null = null;

  return {
    run: async (command, input) => {
      helperPathPromise ??= buildSwiftPackageHelper();
      const helperPath = await helperPathPromise;
      return runHelperProcess(helperPath, command, input);
    },
  };
};

const buildSwiftPackageHelper = async (): Promise<string> => {
  if (process.platform !== "darwin") {
    throw new Error("WhisperKit is only available on macOS.");
  }

  const packagePath = join(app.getAppPath(), "electron", "whisperkit-helper");
  const scratchPath = join(app.getPath("userData"), "helpers", "whisperkit-build");
  const helperPath = join(scratchPath, "release", "whisperkit-helper");

  try {
    await access(helperPath);
    return helperPath;
  } catch {
    await runTextCommand("swift", [
      "build",
      "-c",
      "release",
      "--package-path",
      packagePath,
      "--scratch-path",
      scratchPath,
    ]);
  }

  return helperPath;
};

const runHelperProcess = (
  helperPath: string,
  command: "probe" | "transcribe",
  input?: unknown,
): Promise<HelperResponse> =>
  new Promise((resolve, reject) => {
    const child = spawn(helperPath, [command], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (exitCode) => {
      if (exitCode !== 0) {
        reject(new Error(stderr.trim() || `WhisperKit helper exited with ${exitCode ?? 1}`));
        return;
      }

      try {
        resolve(parseHelperResponse(stdout));
      } catch (error) {
        reject(error);
      }
    });

    child.stdin.end(input === undefined ? undefined : JSON.stringify(input));
  });

const runTextCommand = (command: string, args: readonly string[]): Promise<string> =>
  new Promise((resolve, reject) => {
    const child = spawn(command, [...args]);
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (exitCode) => {
      if (exitCode === 0) {
        resolve(stdout);
        return;
      }

      reject(new Error(stderr.trim() || `${command} exited with ${exitCode ?? 1}`));
    });
  });

const parseHelperResponse = (stdout: string): HelperResponse => {
  const parsed = JSON.parse(stdout) as Partial<HelperResponse>;

  if (typeof parsed.success !== "boolean" || typeof parsed.reason !== "string") {
    throw new Error("Invalid WhisperKit helper response.");
  }

  return parsed as HelperResponse;
};
