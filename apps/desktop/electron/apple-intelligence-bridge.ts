import { app } from "electron";
import { access, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { Effect } from "effect";
import type { AppleIntelligenceTextRequest } from "@topo/native-bridge";
import type { AppleIntelligenceAvailability } from "@topo/shared";

interface HelperResponse {
  readonly success: boolean;
  readonly status: AppleIntelligenceAvailability["status"];
  readonly reason: string;
  readonly text?: string;
}

interface HelperRunner {
  readonly run: (command: "probe" | "generate", input?: unknown) => Promise<HelperResponse>;
}

export const createAppleIntelligenceBridge = ({
  runner = createSwiftHelperRunner(),
}: {
  readonly runner?: HelperRunner;
} = {}) => ({
  getAvailability: () =>
    Effect.tryPromise({
      try: async () => normalizeAvailability(await runner.run("probe")),
      catch: (error) => (error instanceof Error ? error : new Error(String(error))),
    }).pipe(
      Effect.catchAll((error) =>
        Effect.succeed({
          status: "model-not-ready" as const,
          reason: error.message,
        }),
      ),
    ),
  bridge: {
    generate: async (request: AppleIntelligenceTextRequest) => {
      const response = await runner.run("generate", request);

      if (!response.success || !response.text) {
        throw new Error(response.reason);
      }

      return response.text;
    },
  },
});

const normalizeAvailability = (response: HelperResponse): AppleIntelligenceAvailability => ({
  status: response.status,
  reason: response.reason,
});

const createSwiftHelperRunner = (): HelperRunner => {
  let helperPathPromise: Promise<string> | null = null;

  return {
    run: async (command, input) => {
      helperPathPromise ??= buildSwiftHelper();
      const helperPath = await helperPathPromise;
      return runHelperProcess(helperPath, command, input);
    },
  };
};

const buildSwiftHelper = async (): Promise<string> => {
  if (process.platform !== "darwin") {
    throw new Error("Apple Intelligence is only available on macOS.");
  }

  const sourcePath = join(app.getAppPath(), "electron", "apple-intelligence-helper.swift");
  const buildDirectory = join(app.getPath("userData"), "helpers");
  const helperPath = join(buildDirectory, "apple-intelligence-helper");

  try {
    await access(helperPath);
    return helperPath;
  } catch {
    await mkdir(buildDirectory, { recursive: true });
  }

  const sdkPath = await runTextCommand("xcrun", ["--sdk", "macosx", "--show-sdk-path"]);
  await runTextCommand("xcrun", [
    "swiftc",
    "-parse-as-library",
    "-target",
    "arm64-apple-macos26.0",
    "-sdk",
    sdkPath.trim(),
    sourcePath,
    "-o",
    helperPath,
  ]);

  return helperPath;
};

const runHelperProcess = (
  helperPath: string,
  command: "probe" | "generate",
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
        reject(
          new Error(stderr.trim() || `Apple Intelligence helper exited with ${exitCode ?? 1}`),
        );
        return;
      }

      try {
        resolve(parseHelperResponse(stdout));
      } catch (error) {
        reject(error);
      }
    });

    if (input !== undefined) {
      child.stdin.end(JSON.stringify(input));
    } else {
      child.stdin.end();
    }
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

  if (
    typeof parsed.success !== "boolean" ||
    typeof parsed.status !== "string" ||
    typeof parsed.reason !== "string"
  ) {
    throw new Error("Invalid Apple Intelligence helper response.");
  }

  return parsed as HelperResponse;
};
