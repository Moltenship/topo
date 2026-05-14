import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Effect } from "effect";
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

describe("createWhisperCppRuntimeResolver", () => {
  it("prefers the env override before bundled and PATH candidates", async () => {
    const root = await mkdtemp(join(tmpdir(), "topo-whisper-runtime-"));
    const envBinary = await createBinary(root, "env-whisper.exe");
    const bundledBinary = await createBinary(root, "whisper-cli.exe");
    const pathRoot = await mkdtemp(join(tmpdir(), "topo-whisper-path-"));
    await createBinary(pathRoot, "whisper-cli.exe");
    const probedPaths: string[] = [];
    const resolver = createWhisperCppRuntimeResolver({
      resourcesRoot: root,
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
      binaryPath: envBinary,
      source: "env",
      probeOutput: "usage: whisper-cli",
    });
    expect(result.checkedAt).toEqual(expect.any(String));
    expect(new Date(result.checkedAt).toISOString()).toBe(result.checkedAt);
    expect(probedPaths).toEqual([envBinary]);
    expect(result.status === "available" ? result.binaryPath : null).not.toBe(bundledBinary);
  });

  it("returns missing with every checked candidate when no binary exists", async () => {
    const resourcesRoot = await mkdtemp(join(tmpdir(), "topo-whisper-runtime-"));
    const pathRoot = await mkdtemp(join(tmpdir(), "topo-whisper-path-"));
    const resolver = createWhisperCppRuntimeResolver({
      resourcesRoot,
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
      join(resourcesRoot, "missing-env.exe"),
      join(resourcesRoot, "whisper.cpp", "whisper-cli.exe"),
      join(resourcesRoot, "whisper.cpp", "whisper-cli"),
      join(resourcesRoot, "whisper.cpp", "whisper.cpp.exe"),
      join(resourcesRoot, "whisper.cpp", "whisper.cpp"),
      join(resourcesRoot, "whisper.cpp", "main.exe"),
      join(resourcesRoot, "whisper.cpp", "main"),
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
      checkedCandidates: [binaryPath],
    });
    expect(result.message).toContain("not enough magic");
    expect(result.message).toContain("probe exploded");
    expect(result.message).toContain("exit code 2");
  });

  it("checks bundled candidates before PATH candidates", async () => {
    const resourcesRoot = await mkdtemp(join(tmpdir(), "topo-whisper-runtime-"));
    const bundledBinary = await createBinary(join(resourcesRoot, "whisper.cpp"), "whisper-cli.exe");
    const pathRoot = await mkdtemp(join(tmpdir(), "topo-whisper-path-"));
    await createBinary(pathRoot, "whisper-cli.exe");
    const probedPaths: string[] = [];
    const resolver = createWhisperCppRuntimeResolver({
      resourcesRoot,
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
      probeOutput: "usage: whisper-cli",
    });
    expect(probedPaths).toEqual([badBinary, goodBinary]);
  });
});
