import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import { delimiter, join } from "node:path";
import { Effect } from "effect";
import type { InstalledRuntimeRecord } from "@topo/shared";

export interface RuntimeProbeResult {
  readonly ok: boolean;
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number | null;
}

export type RuntimeProbe = (binaryPath: string) => Effect.Effect<RuntimeProbeResult, Error>;

export type WhisperCppRuntimeSource = "installed" | "env" | "bundled" | "path";
export type WhisperCppRuntimeAccelerator = "cpu" | "gpu";
export type WhisperCppAcceleratorPreference = "auto" | "cpu" | "gpu";

export interface WhisperCppRuntimeAvailable {
  readonly status: "available";
  readonly binaryPath: string;
  readonly source: WhisperCppRuntimeSource;
  readonly accelerator: WhisperCppRuntimeAccelerator;
  readonly runtimeId: string | null;
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
  readonly accelerator: WhisperCppRuntimeAccelerator;
  readonly runtimeId: string | null;
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
  readonly installedBinaryPath?: string | null;
  readonly preferredAccelerator?: WhisperCppAcceleratorPreference;
  readonly installedRuntimes?: readonly InstalledRuntimeRecord[];
  readonly env?: NodeJS.ProcessEnv;
  readonly probe?: RuntimeProbe;
}

interface Candidate {
  readonly path: string;
  readonly source: WhisperCppRuntimeSource;
  readonly accelerator: WhisperCppRuntimeAccelerator;
  readonly runtimeId: string | null;
}

interface FailedProbe {
  readonly candidate: Candidate;
  readonly result: RuntimeProbeResult;
}

const envBinaryName = "MOLTEN_WHISPER_CPP_BINARY";
const windowsCpuRuntimeId = "whisper-cpp-windows-x64-cpu";
const windowsCudaRuntimeId = "whisper-cpp-windows-x64-cuda";
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

const createCandidates = (
  resourcesRoot: string,
  env: NodeJS.ProcessEnv,
  installedBinaryPath?: string | null,
  preferredAccelerator: WhisperCppAcceleratorPreference = "auto",
  installedRuntimes: readonly InstalledRuntimeRecord[] = [],
): readonly Candidate[] => {
  const envCandidates: Candidate[] = [];
  const bundledCpuCandidates: Candidate[] = [];
  const bundledGpuCandidates: Candidate[] = [];
  const installedCpuCandidates: Candidate[] = [];
  const installedGpuCandidates: Candidate[] = [];
  const pathCandidates: Candidate[] = [];
  const envOverride = env[envBinaryName];
  const pathValue = env.PATH ?? env.Path ?? "";

  if (installedBinaryPath) {
    installedCpuCandidates.push({
      path: installedBinaryPath,
      source: "installed",
      accelerator: "cpu",
      runtimeId: null,
    });
  }

  for (const runtime of installedRuntimes) {
    if (runtime.verificationStatus !== "verified" || !runtime.binaryPath) {
      continue;
    }

    if (runtime.runtimeId === windowsCudaRuntimeId) {
      installedGpuCandidates.push({
        path: runtime.binaryPath,
        source: "installed",
        accelerator: "gpu",
        runtimeId: runtime.runtimeId,
      });
    }

    if (runtime.runtimeId === windowsCpuRuntimeId) {
      installedCpuCandidates.push({
        path: runtime.binaryPath,
        source: "installed",
        accelerator: "cpu",
        runtimeId: runtime.runtimeId,
      });
    }
  }

  if (envOverride) {
    envCandidates.push({
      path: envOverride,
      source: "env",
      accelerator: preferredAccelerator === "gpu" ? "gpu" : "cpu",
      runtimeId: null,
    });
  }

  for (const binaryName of binaryNames) {
    bundledGpuCandidates.push({
      path: join(resourcesRoot, "whisper.cpp-cuda", binaryName),
      source: "bundled",
      accelerator: "gpu",
      runtimeId: windowsCudaRuntimeId,
    });
    bundledCpuCandidates.push({
      path: join(resourcesRoot, "whisper.cpp-cpu", binaryName),
      source: "bundled",
      accelerator: "cpu",
      runtimeId: windowsCpuRuntimeId,
    });
    bundledCpuCandidates.push({
      path: join(resourcesRoot, "whisper.cpp", binaryName),
      source: "bundled",
      accelerator: "cpu",
      runtimeId: null,
    });
  }

  for (const pathEntry of pathValue.split(delimiter).filter(Boolean)) {
    for (const binaryName of binaryNames) {
      pathCandidates.push({
        path: join(pathEntry, binaryName),
        source: "path",
        accelerator: preferredAccelerator === "gpu" ? "gpu" : "cpu",
        runtimeId: null,
      });
    }
  }

  if (preferredAccelerator === "gpu") {
    return [...installedGpuCandidates, ...bundledGpuCandidates, ...envCandidates, ...pathCandidates];
  }

  if (preferredAccelerator === "cpu") {
    return [...installedCpuCandidates, ...bundledCpuCandidates, ...envCandidates, ...pathCandidates];
  }

  return [
    ...installedGpuCandidates,
    ...bundledGpuCandidates,
    ...installedCpuCandidates,
    ...bundledCpuCandidates,
    ...envCandidates,
    ...pathCandidates,
  ];
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

    return Effect.sync(() => {
      clearTimeout(timeout);

      if (!completed) {
        completed = true;
        childProcess.kill();
      }
    });
  });

export const createWhisperCppRuntimeResolver = ({
  resourcesRoot,
  installedBinaryPath = null,
  preferredAccelerator = "auto",
  installedRuntimes = [],
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
        const candidates = createCandidates(
          resourcesRoot,
          env,
          installedBinaryPath,
          preferredAccelerator,
          installedRuntimes,
        );
        const checkedCandidates: string[] = [];
        const failedProbes: FailedProbe[] = [];

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
            if (candidate.source === "env") {
              return {
                status: "failed",
                binaryPath: candidate.path,
                source: candidate.source,
                accelerator: candidate.accelerator,
                runtimeId: candidate.runtimeId,
                checkedCandidates,
                message: createFailedMessage(probeResult),
                checkedAt,
              };
            }

            failedProbes.push({
              candidate,
              result: probeResult,
            });
            continue;
          }

          cachedAvailable = {
            status: "available",
            binaryPath: candidate.path,
            source: candidate.source,
            accelerator: candidate.accelerator,
            runtimeId: candidate.runtimeId,
            probeOutput: compactOutput(probeResult),
            checkedAt,
          };

          return cachedAvailable;
        }

        const firstFailedProbe = failedProbes[0];

        if (firstFailedProbe) {
          return {
            status: "failed",
            binaryPath: firstFailedProbe.candidate.path,
            source: firstFailedProbe.candidate.source,
            accelerator: firstFailedProbe.candidate.accelerator,
            runtimeId: firstFailedProbe.candidate.runtimeId,
            checkedCandidates,
            message: createFailedMessage(firstFailedProbe.result),
            checkedAt,
          };
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
