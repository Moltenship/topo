import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Effect } from "effect";
import type { InstalledRuntimeRecord } from "@topo/shared";
import { describe, expect, it } from "vitest";
import { createWhisperCppRuntimeResolver, type RuntimeProbe } from "./whisper-cpp-runtime";

const createBinary = async (root: string, relativePath: string): Promise<string> => {
  const binaryPath = join(root, relativePath);

  await mkdir(dirname(binaryPath), { recursive: true });
  await writeFile(binaryPath, "binary");

  return binaryPath;
};

const createProbe =
  (result = { ok: true, stdout: "usage: whisper-cli", stderr: "", exitCode: 0 }): RuntimeProbe =>
  (binaryPath) =>
    Effect.succeed({
      ...result,
      stdout: result.stdout.replace("$binary", binaryPath),
    });

const installedRuntime = ({
  runtimeId,
  binaryPath,
}: {
  readonly runtimeId: InstalledRuntimeRecord["runtimeId"];
  readonly binaryPath: string;
}): InstalledRuntimeRecord => ({
  id: `installed-${runtimeId}`,
  runtimeId,
  engine: "whisper-cpp",
  installedPath: dirname(binaryPath),
  binaryPath,
  checksumSha256: "runtime-sha",
  verificationStatus: "verified",
  installedAt: "2026-05-09T10:00:00.000Z",
  lastProbedAt: "2026-05-09T10:00:00.000Z",
  lastProbeMessage: "usage: whisper-cli",
});

describe("createWhisperCppRuntimeResolver", () => {
  it("prefers bundled candidates before env and PATH candidates", async () => {
    const root = await mkdtemp(join(tmpdir(), "topo-whisper-runtime-"));
    const envBinary = await createBinary(root, "env-whisper.exe");
    const bundledBinary = await createBinary(root, "whisper.cpp-cpu/whisper-cli.exe");
    const pathRoot = await mkdtemp(join(tmpdir(), "topo-whisper-path-"));
    await createBinary(pathRoot, "whisper-cli.exe");
    const probedPaths: string[] = [];
    const resolver = createWhisperCppRuntimeResolver({
      resourcesRoot: root,
      preferredAccelerator: "cpu",
      env: {
        MOLTEN_WHISPER_CPP_BINARY: envBinary,
        PATH: pathRoot,
      },
      probe: (binaryPath) => {
        probedPaths.push(binaryPath);

        return createProbe()(binaryPath);
      },
    });

    const result = await Effect.runPromise(resolver.resolve());

    expect(result).toMatchObject({
      status: "available",
      binaryPath: bundledBinary,
      source: "bundled",
      accelerator: "cpu",
      runtimeId: "whisper-cpp-windows-x64-cpu",
      probeOutput: "usage: whisper-cli",
    });
    expect(result.checkedAt).toEqual(expect.any(String));
    expect(new Date(result.checkedAt).toISOString()).toBe(result.checkedAt);
    expect(probedPaths).toEqual([bundledBinary]);
    expect(result.status === "available" ? result.binaryPath : null).not.toBe(envBinary);
  });

  it("prefers an installed runtime before env, bundled, and PATH candidates", async () => {
    const root = await mkdtemp(join(tmpdir(), "topo-whisper-runtime-"));
    const installedBinary = await createBinary(root, "installed/whisper-cli.exe");
    const envBinary = await createBinary(root, "env-whisper.exe");
    const probedPaths: string[] = [];
    const resolver = createWhisperCppRuntimeResolver({
      resourcesRoot: root,
      installedBinaryPath: installedBinary,
      preferredAccelerator: "cpu",
      env: {
        MOLTEN_WHISPER_CPP_BINARY: envBinary,
        PATH: "",
      },
      probe: (binaryPath) => {
        probedPaths.push(binaryPath);

        return createProbe()(binaryPath);
      },
    });

    const result = await Effect.runPromise(resolver.resolve());

    expect(result).toMatchObject({
      status: "available",
      binaryPath: installedBinary,
      source: "installed",
      accelerator: "cpu",
      runtimeId: null,
    });
    expect(probedPaths).toEqual([installedBinary]);
  });

  it("returns missing with every checked candidate when no binary exists", async () => {
    const resourcesRoot = await mkdtemp(join(tmpdir(), "topo-whisper-runtime-"));
    const pathRoot = await mkdtemp(join(tmpdir(), "topo-whisper-path-"));
    const resolver = createWhisperCppRuntimeResolver({
      resourcesRoot,
      preferredAccelerator: "cpu",
      env: {
        MOLTEN_WHISPER_CPP_BINARY: join(resourcesRoot, "missing-env.exe"),
        PATH: pathRoot,
      },
      probe: createProbe(),
    });

    const result = await Effect.runPromise(resolver.resolve());

    expect(result.status).toBe("missing");
    if (result.status !== "missing") {
      throw new Error(`Expected missing result, got ${result.status}`);
    }
    expect(result.checkedCandidates).toEqual([
      join(resourcesRoot, "whisper.cpp-cpu", "whisper-cli.exe"),
      join(resourcesRoot, "whisper.cpp", "whisper-cli.exe"),
      join(resourcesRoot, "whisper.cpp-cpu", "whisper-cli"),
      join(resourcesRoot, "whisper.cpp", "whisper-cli"),
      join(resourcesRoot, "whisper.cpp-cpu", "whisper.cpp.exe"),
      join(resourcesRoot, "whisper.cpp", "whisper.cpp.exe"),
      join(resourcesRoot, "whisper.cpp-cpu", "whisper.cpp"),
      join(resourcesRoot, "whisper.cpp", "whisper.cpp"),
      join(resourcesRoot, "whisper.cpp-cpu", "main.exe"),
      join(resourcesRoot, "whisper.cpp", "main.exe"),
      join(resourcesRoot, "whisper.cpp-cpu", "main"),
      join(resourcesRoot, "whisper.cpp", "main"),
      join(resourcesRoot, "missing-env.exe"),
      join(pathRoot, "whisper-cli.exe"),
      join(pathRoot, "whisper-cli"),
      join(pathRoot, "whisper.cpp.exe"),
      join(pathRoot, "whisper.cpp"),
      join(pathRoot, "main.exe"),
      join(pathRoot, "main"),
    ]);
    expect(result.message).toContain("whisper.cpp runtime was not found");
  });

  it("returns failed with the candidate path and probe error output", async () => {
    const root = await mkdtemp(join(tmpdir(), "topo-whisper-runtime-"));
    const binaryPath = await createBinary(root, "env-whisper.exe");
    const resolver = createWhisperCppRuntimeResolver({
      resourcesRoot: root,
      preferredAccelerator: "cpu",
      env: {
        MOLTEN_WHISPER_CPP_BINARY: binaryPath,
        PATH: "",
      },
      probe: createProbe({
        ok: false,
        stdout: "not enough magic",
        stderr: "probe exploded",
        exitCode: 2,
      }),
    });

    const result = await Effect.runPromise(resolver.resolve());

    expect(result.status).toBe("failed");
    if (result.status !== "failed") {
      throw new Error(`Expected failed result, got ${result.status}`);
    }
    expect(result).toMatchObject({
      status: "failed",
      binaryPath,
      source: "env",
      accelerator: "cpu",
      runtimeId: null,
    });
    expect(result.checkedCandidates.at(-1)).toBe(binaryPath);
    expect(result.message).toContain("not enough magic");
    expect(result.message).toContain("probe exploded");
    expect(result.message).toContain("exit code 2");
  });

  it("checks bundled candidates before PATH candidates", async () => {
    const resourcesRoot = await mkdtemp(join(tmpdir(), "topo-whisper-runtime-"));
    const bundledBinary = await createBinary(
      join(resourcesRoot, "whisper.cpp-cpu"),
      "whisper-cli.exe",
    );
    const pathRoot = await mkdtemp(join(tmpdir(), "topo-whisper-path-"));
    await createBinary(pathRoot, "whisper-cli.exe");
    const probedPaths: string[] = [];
    const resolver = createWhisperCppRuntimeResolver({
      resourcesRoot,
      preferredAccelerator: "cpu",
      env: {
        PATH: pathRoot,
      },
      probe: (binaryPath) => {
        probedPaths.push(binaryPath);

        return createProbe()(binaryPath);
      },
    });

    const result = await Effect.runPromise(resolver.resolve());

    expect(result).toMatchObject({
      status: "available",
      binaryPath: bundledBinary,
      source: "bundled",
      accelerator: "cpu",
      runtimeId: "whisper-cpp-windows-x64-cpu",
    });
    expect(probedPaths).toEqual([bundledBinary]);
  });

  it("continues after a failed PATH probe and returns the next usable PATH candidate", async () => {
    const resourcesRoot = await mkdtemp(join(tmpdir(), "topo-whisper-runtime-"));
    const badPathRoot = await mkdtemp(join(tmpdir(), "topo-whisper-bad-path-"));
    const goodPathRoot = await mkdtemp(join(tmpdir(), "topo-whisper-good-path-"));
    const badBinary = await createBinary(badPathRoot, "whisper-cli.exe");
    const goodBinary = await createBinary(goodPathRoot, "whisper-cli.exe");
    const probedPaths: string[] = [];
    const resolver = createWhisperCppRuntimeResolver({
      resourcesRoot,
      preferredAccelerator: "cpu",
      env: {
        PATH: `${badPathRoot}${process.platform === "win32" ? ";" : ":"}${goodPathRoot}`,
      },
      probe: (binaryPath) => {
        probedPaths.push(binaryPath);

        return Effect.succeed(
          binaryPath === badBinary
            ? {
                ok: false,
                stdout: "",
                stderr: "bad PATH binary",
                exitCode: 1,
              }
            : {
                ok: true,
                stdout: "usage: whisper-cli",
                stderr: "",
                exitCode: 0,
              },
        );
      },
    });

    const result = await Effect.runPromise(resolver.resolve());

    expect(result).toMatchObject({
      status: "available",
      binaryPath: goodBinary,
      source: "path",
      accelerator: "cpu",
      probeOutput: "usage: whisper-cli",
    });
    expect(probedPaths).toEqual([badBinary, goodBinary]);
  });

  it("auto picks CUDA when verified CUDA and CPU runtimes are installed", async () => {
    const root = await mkdtemp(join(tmpdir(), "topo-whisper-runtime-"));
    const cudaBinary = await createBinary(root, "cuda/whisper-cli.exe");
    const cpuBinary = await createBinary(root, "cpu/whisper-cli.exe");
    const probedPaths: string[] = [];
    const resolver = createWhisperCppRuntimeResolver({
      resourcesRoot: root,
      preferredAccelerator: "auto",
      installedRuntimes: [
        installedRuntime({
          runtimeId: "whisper-cpp-windows-x64-cpu",
          binaryPath: cpuBinary,
        }),
        installedRuntime({
          runtimeId: "whisper-cpp-windows-x64-cuda",
          binaryPath: cudaBinary,
        }),
      ],
      env: { PATH: "" },
      probe: (binaryPath) => {
        probedPaths.push(binaryPath);

        return createProbe()(binaryPath);
      },
    });

    const result = await Effect.runPromise(resolver.resolve());

    expect(result).toMatchObject({
      status: "available",
      binaryPath: cudaBinary,
      accelerator: "gpu",
      runtimeId: "whisper-cpp-windows-x64-cuda",
    });
    expect(probedPaths).toEqual([cudaBinary]);
  });

  it("auto falls back to CPU when CUDA probe fails", async () => {
    const root = await mkdtemp(join(tmpdir(), "topo-whisper-runtime-"));
    const cudaBinary = await createBinary(root, "cuda/whisper-cli.exe");
    const cpuBinary = await createBinary(root, "cpu/whisper-cli.exe");
    const probedPaths: string[] = [];
    const resolver = createWhisperCppRuntimeResolver({
      resourcesRoot: root,
      preferredAccelerator: "auto",
      installedRuntimes: [
        installedRuntime({
          runtimeId: "whisper-cpp-windows-x64-cuda",
          binaryPath: cudaBinary,
        }),
        installedRuntime({
          runtimeId: "whisper-cpp-windows-x64-cpu",
          binaryPath: cpuBinary,
        }),
      ],
      env: { PATH: "" },
      probe: (binaryPath) => {
        probedPaths.push(binaryPath);

        return Effect.succeed(
          binaryPath === cudaBinary
            ? { ok: false, stdout: "", stderr: "CUDA unavailable", exitCode: 1 }
            : { ok: true, stdout: "usage: whisper-cli", stderr: "", exitCode: 0 },
        );
      },
    });

    const result = await Effect.runPromise(resolver.resolve());

    expect(result).toMatchObject({
      status: "available",
      binaryPath: cpuBinary,
      accelerator: "cpu",
      runtimeId: "whisper-cpp-windows-x64-cpu",
    });
    expect(probedPaths).toEqual([cudaBinary, cpuBinary]);
  });

  it("gpu reports failure when CUDA probe fails instead of using CPU", async () => {
    const root = await mkdtemp(join(tmpdir(), "topo-whisper-runtime-"));
    const cudaBinary = await createBinary(root, "cuda/whisper-cli.exe");
    const cpuBinary = await createBinary(root, "cpu/whisper-cli.exe");
    const resolver = createWhisperCppRuntimeResolver({
      resourcesRoot: root,
      preferredAccelerator: "gpu",
      installedRuntimes: [
        installedRuntime({
          runtimeId: "whisper-cpp-windows-x64-cuda",
          binaryPath: cudaBinary,
        }),
        installedRuntime({
          runtimeId: "whisper-cpp-windows-x64-cpu",
          binaryPath: cpuBinary,
        }),
      ],
      env: { PATH: "" },
      probe: createProbe({
        ok: false,
        stdout: "",
        stderr: "CUDA unavailable",
        exitCode: 1,
      }),
    });

    const result = await Effect.runPromise(resolver.resolve());

    expect(result).toMatchObject({
      status: "failed",
      binaryPath: cudaBinary,
      accelerator: "gpu",
      runtimeId: "whisper-cpp-windows-x64-cuda",
    });
  });

  it("cpu ignores a working CUDA runtime", async () => {
    const root = await mkdtemp(join(tmpdir(), "topo-whisper-runtime-"));
    const cudaBinary = await createBinary(root, "cuda/whisper-cli.exe");
    const cpuBinary = await createBinary(root, "cpu/whisper-cli.exe");
    const probedPaths: string[] = [];
    const resolver = createWhisperCppRuntimeResolver({
      resourcesRoot: root,
      preferredAccelerator: "cpu",
      installedRuntimes: [
        installedRuntime({
          runtimeId: "whisper-cpp-windows-x64-cuda",
          binaryPath: cudaBinary,
        }),
        installedRuntime({
          runtimeId: "whisper-cpp-windows-x64-cpu",
          binaryPath: cpuBinary,
        }),
      ],
      env: { PATH: "" },
      probe: (binaryPath) => {
        probedPaths.push(binaryPath);

        return createProbe()(binaryPath);
      },
    });

    const result = await Effect.runPromise(resolver.resolve());

    expect(result).toMatchObject({
      status: "available",
      binaryPath: cpuBinary,
      accelerator: "cpu",
      runtimeId: "whisper-cpp-windows-x64-cpu",
    });
    expect(probedPaths).toEqual([cpuBinary]);
  });
});
