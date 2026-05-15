import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import type { RuntimeCatalogEntry } from "@topo/model-catalog";
import type { InstalledRuntimeRecord } from "@topo/shared";
import { createFileRuntimeInstallJob } from "./runtime-install-job";

const sha256 = (content: string): string => createHash("sha256").update(content).digest("hex");

const createRuntime = (content: string): RuntimeCatalogEntry => ({
  id: "whisper-cpp-windows-x64-cpu",
  displayName: "Whisper.cpp Windows x64",
  engine: "whisper-cpp",
  platform: "windows",
  architecture: "x64",
  version: "test",
  source: {
    type: "direct-url",
    url: "https://example.test/runtime.zip",
  },
  checksumSha256: sha256(content),
  downloadSizeBytes: Buffer.byteLength(content),
  diskSizeBytes: Buffer.byteLength(content),
  binaryRelativePath: "whisper-cli.exe",
  probeArgs: ["--help"],
});

const createRepository = () => {
  const records: InstalledRuntimeRecord[] = [];

  return {
    records,
    repository: {
      list: () => Effect.succeed(records),
      getByRuntimeId: (runtimeId: string) =>
        Effect.succeed(records.find((record) => record.runtimeId === runtimeId) ?? null),
      upsert: (record: InstalledRuntimeRecord) =>
        Effect.sync(() => {
          const index = records.findIndex((existing) => existing.id === record.id);

          if (index >= 0) {
            records[index] = record;
          } else {
            records.push(record);
          }

          return record;
        }),
      removeByRuntimeId: (runtimeId: string) =>
        Effect.sync(() => {
          const index = records.findIndex((record) => record.runtimeId === runtimeId);

          if (index >= 0) {
            records.splice(index, 1);
          }
        }),
    },
  };
};

describe("createFileRuntimeInstallJob", () => {
  it("fails if checksum mismatches and removes the temp artifact", async () => {
    const installRoot = await mkdtemp(join(tmpdir(), "topo-runtime-install-"));
    const content = "runtime zip payload";
    const runtime = {
      ...createRuntime("expected"),
      checksumSha256: sha256("different"),
    };
    const { repository, records } = createRepository();
    const job = createFileRuntimeInstallJob({
      installRoot,
      catalog: [runtime],
      repository,
      fetch: async () =>
        new Response(content, {
          headers: { "content-length": String(Buffer.byteLength(content)) },
        }),
      extractArchive: async () => undefined,
      probeRuntime: async () => ({ ok: true, message: "ok" }),
    });

    await expect(Effect.runPromise(job.start(runtime.id, () => undefined))).rejects.toThrow(
      "Downloaded runtime verification failed",
    );

    expect(existsSync(join(installRoot, runtime.id, `${runtime.id}.zip.download`))).toBe(false);
    expect(records).toEqual([]);
  });

  it("extracts into a temporary directory before renaming and records the binary path", async () => {
    const installRoot = await mkdtemp(join(tmpdir(), "topo-runtime-install-"));
    const content = "runtime zip payload";
    const runtime = createRuntime(content);
    const { repository, records } = createRepository();
    const observedExtractionTargets: string[] = [];
    const job = createFileRuntimeInstallJob({
      installRoot,
      catalog: [runtime],
      repository,
      fetch: async () =>
        new Response(content, {
          headers: { "content-length": String(Buffer.byteLength(content)) },
        }),
      extractArchive: async (_archivePath, targetDirectory) => {
        observedExtractionTargets.push(targetDirectory);
        await mkdir(targetDirectory, { recursive: true });
        await writeFile(join(targetDirectory, "whisper-cli.exe"), "binary");
      },
      probeRuntime: async () => ({ ok: true, message: "ok" }),
    });

    await expect(Effect.runPromise(job.start(runtime.id, () => undefined))).resolves.toMatchObject({
      modelId: runtime.id,
      status: "installed",
    });

    expect(observedExtractionTargets).toEqual([join(installRoot, runtime.id, ".extracting")]);
    expect(await readFile(join(installRoot, runtime.id, "whisper-cli.exe"), "utf8")).toBe("binary");
    expect(records).toEqual([
      expect.objectContaining({
        runtimeId: runtime.id,
        engine: runtime.engine,
        installedPath: join(installRoot, runtime.id),
        binaryPath: join(installRoot, runtime.id, "whisper-cli.exe"),
        verificationStatus: "verified",
      }),
    ]);
  });

  it("cancels an active runtime download and deletes the temporary file", async () => {
    const installRoot = await mkdtemp(join(tmpdir(), "topo-runtime-install-"));
    const content = "runtime zip payload";
    const runtime = createRuntime(content);
    const { repository } = createRepository();
    let releaseDownload: () => void = () => undefined;
    let markFetchStarted: () => void = () => undefined;
    const fetchStarted = new Promise<void>((resolve) => {
      markFetchStarted = resolve;
    });
    const job = createFileRuntimeInstallJob({
      installRoot,
      catalog: [runtime],
      repository,
      fetch: async (_url, init) => {
        markFetchStarted();
        await new Promise<void>((resolve) => {
          releaseDownload = resolve;
          init?.signal?.addEventListener("abort", () => resolve(), { once: true });
        });

        return new Response(content, {
          headers: { "content-length": String(Buffer.byteLength(content)) },
        });
      },
      extractArchive: async () => undefined,
      probeRuntime: async () => ({ ok: true, message: "ok" }),
    });

    const started = Effect.runPromise(job.start(runtime.id, () => undefined));
    await fetchStarted;
    await Effect.runPromise(job.cancel(runtime.id));
    releaseDownload();

    await expect(started).resolves.toMatchObject({ status: "canceled" });
    expect(existsSync(join(installRoot, runtime.id, `${runtime.id}.zip.download`))).toBe(false);
  });

  it("removes the extraction directory when probing the extracted binary fails", async () => {
    const installRoot = await mkdtemp(join(tmpdir(), "topo-runtime-install-"));
    const content = "runtime zip payload";
    const runtime = createRuntime(content);
    const { repository, records } = createRepository();
    const job = createFileRuntimeInstallJob({
      installRoot,
      catalog: [runtime],
      repository,
      fetch: async () =>
        new Response(content, {
          headers: { "content-length": String(Buffer.byteLength(content)) },
        }),
      extractArchive: async (_archivePath, targetDirectory) => {
        await mkdir(targetDirectory, { recursive: true });
        await writeFile(join(targetDirectory, "whisper-cli.exe"), "binary");
      },
      probeRuntime: async () => ({ ok: false, message: "probe failed" }),
    });

    await expect(Effect.runPromise(job.start(runtime.id, () => undefined))).rejects.toThrow(
      "Runtime probe failed",
    );

    expect(await readdir(join(installRoot, runtime.id))).toEqual([]);
    expect(records).toEqual([]);
  });
});
