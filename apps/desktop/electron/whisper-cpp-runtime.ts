import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import { delimiter, join } from "node:path";
import { Effect } from "effect";

export interface RuntimeProbeResult {
  readonly ok: boolean;
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number | null;
}

export type RuntimeProbe = (binaryPath: string) => Effect.Effect<RuntimeProbeResult, Error>;

export type WhisperCppRuntimeSource = "env" | "bundled" | "path";

export interface WhisperCppRuntimeAvailable {
  readonly status: "available";
  readonly binaryPath: string;
  readonly source: WhisperCppRuntimeSource;
  readonly probeOutput: string;
  readonly checkedAt: string;
}

export interface WhisperCppRuntimeMissing {
  readonly status: "missing";
  readonly checkedCandidates: readonly string[];
  readonly message: string;
  readonly checkedAt: string;
}

export interface WhisperCppRuntimeFailed {
  readonly status: "failed";
  readonly binaryPath: string;
  readonly source: WhisperCppRuntimeSource;
  readonly checkedCandidates: readonly string[];
  readonly message: string;
  readonly checkedAt: string;
}

export type WhisperCppRuntimeResult =
  | WhisperCppRuntimeAvailable
  | WhisperCppRuntimeMissing
  | WhisperCppRuntimeFailed;

export type WhisperCppRuntimeResolution = WhisperCppRuntimeResult;

export interface WhisperCppRuntimeResolver {
  readonly resolve: () => Effect.Effect<WhisperCppRuntimeResult, never>;
}

export interface WhisperCppRuntimeResolverOptions {
  readonly resourcesRoot: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly probe?: RuntimeProbe;
}

interface Candidate {
  readonly path: string;
  readonly source: WhisperCppRuntimeSource;
}

const envBinaryName = "MOLTEN_WHISPER_CPP_BINARY";
const binaryNames = [
  "whisper-cli.exe",
  "whisper-cli",
  "whisper.cpp.exe",
  "whisper.cpp",
  "main.exe",
  "main",
] as const;

const now = (): Date => new Date();

const compactOutput = ({ stdout, stderr, exitCode }: RuntimeProbeResult): string => {
  const output = [stdout.trim(), stderr.trim()].filter(Boolean).join("\n");

  return (
    output || `Probe exited with ${exitCode === null ? "no exit code" : `exit code ${exitCode}`}`
  );
};

const createFailedMessage = (probeResult: RuntimeProbeResult): string => {
  const output = compactOutput(probeResult);
  const exitCode =
    probeResult.exitCode === null ? "no exit code" : `exit code ${probeResult.exitCode}`;

  return `whisper.cpp runtime probe failed with ${exitCode}: ${output}`;
};

const createCandidates = (resourcesRoot: string, env: NodeJS.ProcessEnv): readonly Candidate[] => {
  const candidates: Candidate[] = [];
  const envOverride = env[envBinaryName];
  const pathValue = env.PATH ?? env.Path ?? "";

  if (envOverride) {
    candidates.push({
      path: envOverride,
      source: "env",
    });
  }

  for (const binaryName of binaryNames) {
    candidates.push({
      path: join(resourcesRoot, "whisper.cpp", binaryName),
      source: "bundled",
    });
  }

  for (const pathEntry of pathValue.split(delimiter).filter(Boolean)) {
    for (const binaryName of binaryNames) {
      candidates.push({
        path: join(pathEntry, binaryName),
        source: "path",
      });
    }
  }

  return candidates;
};

const fileExists = (path: string): Effect.Effect<boolean, never> =>
  Effect.promise(async () => {
    try {
      return (await stat(path)).isFile();
    } catch {
      return false;
    }
  });

export const defaultRuntimeProbe: RuntimeProbe = (binaryPath) =>
  Effect.async<RuntimeProbeResult, Error>((resume) => {
    const childProcess = spawn(binaryPath, ["--help"], {
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    let completed = false;
    const timeout = setTimeout(() => {
      if (completed) {
        return;
      }

      completed = true;
      childProcess.kill();
      resume(
        Effect.succeed({
          ok: false,
          stdout,
          stderr: stderr
            ? `${stderr}\nProbe timed out after 2500ms`
            : "Probe timed out after 2500ms",
          exitCode: null,
        }),
      );
    }, 2500);

    childProcess.stdout?.setEncoding("utf8");
    childProcess.stderr?.setEncoding("utf8");
    childProcess.stdout?.on("data", (chunk) => {
      stdout += String(chunk);
    });
    childProcess.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    childProcess.once("error", (error) => {
      if (completed) {
        return;
      }

      completed = true;
      clearTimeout(timeout);
      resume(
        Effect.succeed({
          ok: false,
          stdout,
          stderr: stderr ? `${stderr}\n${error.message}` : error.message,
          exitCode: null,
        }),
      );
    });
    childProcess.once("close", (exitCode) => {
      if (completed) {
        return;
      }

      completed = true;
      clearTimeout(timeout);

      const output = `${stdout}\n${stderr}`;
      const ok = exitCode === 0 || /usage|whisper/i.test(output);

      resume(
        Effect.succeed({
          ok,
          stdout,
          stderr,
          exitCode,
        }),
      );
    });
  });

export const createWhisperCppRuntimeResolver = ({
  resourcesRoot,
  env = process.env,
  probe = defaultRuntimeProbe,
}: WhisperCppRuntimeResolverOptions): WhisperCppRuntimeResolver => {
  let cachedAvailable: WhisperCppRuntimeAvailable | null = null;

  return {
    resolve: () =>
      Effect.gen(function* () {
        if (cachedAvailable) {
          return cachedAvailable;
        }

        const checkedAt = now().toISOString();
        const candidates = createCandidates(resourcesRoot, env);
        const checkedCandidates: string[] = [];

        for (const candidate of candidates) {
          checkedCandidates.push(candidate.path);

          if (!(yield* fileExists(candidate.path))) {
            continue;
          }

          const probeResult = yield* probe(candidate.path).pipe(
            Effect.catchAll((error) =>
              Effect.succeed({
                ok: false,
                stdout: "",
                stderr: error.message,
                exitCode: null,
              }),
            ),
          );

          if (!probeResult.ok) {
            return {
              status: "failed",
              binaryPath: candidate.path,
              source: candidate.source,
              checkedCandidates,
              message: createFailedMessage(probeResult),
              checkedAt,
            };
          }

          cachedAvailable = {
            status: "available",
            binaryPath: candidate.path,
            source: candidate.source,
            probeOutput: compactOutput(probeResult),
            checkedAt,
          };

          return cachedAvailable;
        }

        return {
          status: "missing",
          checkedCandidates,
          message:
            "whisper.cpp runtime was not found. Set MOLTEN_WHISPER_CPP_BINARY or install whisper-cli on PATH.",
          checkedAt,
        };
      }),
  };
};
