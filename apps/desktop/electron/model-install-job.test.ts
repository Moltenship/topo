import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import type { ModelCatalogEntry } from "@topo/model-catalog";
import { createFileModelInstallJob } from "./model-install-job";

const sha256 = (content: string): string => createHash("sha256").update(content).digest("hex");

const createTestModel = (content: string): ModelCatalogEntry => ({
  id: "test-model",
  displayName: "Test Model",
  runtime: "whisper-cpp",
  runtimeRequirement: {
    engine: "whisper-cpp",
    supportedRuntimeIds: ["whisper-cpp-windows-x64-cpu"],
  },
  platforms: ["windows"],
  architectures: ["x64"],
  languages: ["en", "ru"],
  source: {
    type: "direct-url",
    url: "https://example.test/model.bin",
  },
  installStrategy: {
    type: "single-file",
  },
  downloadUrl: "https://example.test/model.bin",
  checksumSha256: sha256(content),
  downloadSizeBytes: Buffer.byteLength(content),
  diskSizeBytes: Buffer.byteLength(content),
  estimatedMemoryBytes: 1024,
  qualityLabel: "fast",
  speedLabel: "fastest",
  accuracyScore: 10,
  speedScore: 100,
  recommendedReason: "Test fixture.",
  badges: [],
  experimental: false,
});

const createArchiveModel = (content: string): ModelCatalogEntry => ({
  ...createTestModel(content),
  id: "archive-model",
  displayName: "Archive Model",
  source: {
    type: "direct-url",
    url: "https://example.test/archive-model.zip",
  },
  installStrategy: {
    type: "archive-directory",
    requiredFiles: ["config.json"],
  },
  downloadUrl: "https://example.test/archive-model.zip",
});

const createSnapshotModel = (): ModelCatalogEntry => ({
  ...createTestModel(""),
  id: "snapshot-model",
  displayName: "Snapshot Model",
  runtime: "whisperkit",
  runtimeRequirement: {
    engine: "whisperkit",
    supportedRuntimeIds: ["whisperkit"],
  },
  platforms: ["macos"],
  architectures: ["arm64"],
  source: {
    type: "huggingface-snapshot",
    repo: "argmaxinc/whisperkit-coreml",
    revision: "97a5bf9bbc74c7d9c12c755d04dea59e672e3808",
    subfolder: "openai_whisper-small",
  },
  installStrategy: {
    type: "huggingface-snapshot-directory",
    requiredFiles: ["AudioEncoder.mlmodelc/metadata.json"],
  },
  downloadUrl:
    "https://huggingface.co/argmaxinc/whisperkit-coreml/tree/97a5bf9bbc74c7d9c12c755d04dea59e672e3808/openai_whisper-small",
  checksumSha256: "snapshot",
  downloadSizeBytes: 2,
  diskSizeBytes: 2,
});

describe("createFileModelInstallJob", () => {
  it("downloads, verifies, and installs a single-file model", async () => {
    const content = "tiny model payload";
    const installRoot = await mkdtemp(join(tmpdir(), "topo-model-install-"));
    const model = createTestModel(content);
    const progressStatuses: string[] = [];
    const job = createFileModelInstallJob({
      installRoot,
      catalog: [model],
      fetch: async () =>
        new Response(content, {
          headers: {
            "content-length": String(Buffer.byteLength(content)),
          },
        }),
    });

    const result = await Effect.runPromise(
      job.start(model.id, () => {
        const progress = job.getCurrentProgress();

        if (progress) {
          progressStatuses.push(progress.status);
        }
      }),
    );
    const installedPath = job.getInstalledModelPath(model.id);

    expect(result.status).toBe("installed");
    expect(progressStatuses).toEqual([
      "queued",
      "resolving",
      "downloading",
      "downloading",
      "verifying",
      "installing",
      "installed",
    ]);
    expect(installedPath).toBe(`${installRoot}/test-model/test-model.bin`);
    await expect(readFile(installedPath ?? "", "utf8")).resolves.toBe(content);
  });

  it("installs a dev-only local file model through the same verification flow", async () => {
    const content = "local smoke payload";
    const installRoot = await mkdtemp(join(tmpdir(), "topo-model-install-"));
    const resourcesRoot = await mkdtemp(join(tmpdir(), "topo-model-resources-"));
    const model = {
      ...createTestModel(content),
      source: {
        type: "local-file",
        relativePath: "dev-models/dev-smoke-model.bin",
      },
      downloadUrl: "local-file://dev-models/dev-smoke-model.bin",
      devOnly: true,
    } satisfies ModelCatalogEntry;

    await mkdir(join(resourcesRoot, "dev-models"), { recursive: true });
    await writeFile(join(resourcesRoot, "dev-models", "dev-smoke-model.bin"), content);

    const job = createFileModelInstallJob({
      installRoot,
      resourcesRoot,
      catalog: [model],
      fetch: async () => {
        throw new Error("Local file model should not use fetch");
      },
    });

    await expect(Effect.runPromise(job.start(model.id, () => undefined))).resolves.toMatchObject({
      modelId: model.id,
      status: "installed",
    });
    await expect(readFile(job.getInstalledModelPath(model.id) ?? "", "utf8")).resolves.toBe(
      content,
    );
  });

  it("downloads, verifies, extracts, and installs an archive-directory model", async () => {
    const content = "archive payload";
    const installRoot = await mkdtemp(join(tmpdir(), "topo-model-install-"));
    const model = createArchiveModel(content);
    const observedExtractionTargets: string[] = [];
    const job = createFileModelInstallJob({
      installRoot,
      catalog: [model],
      fetch: async () =>
        new Response(content, {
          headers: {
            "content-length": String(Buffer.byteLength(content)),
          },
        }),
      extractArchive: async (_archivePath, targetDirectory) => {
        observedExtractionTargets.push(targetDirectory);
        await mkdir(targetDirectory, { recursive: true });
        await writeFile(join(targetDirectory, "config.json"), "{}");
      },
    });

    await expect(Effect.runPromise(job.start(model.id, () => undefined))).resolves.toMatchObject({
      modelId: model.id,
      status: "installed",
    });

    expect(observedExtractionTargets).toEqual([join(installRoot, model.id, ".extracting")]);
    expect(job.getInstalledModelPath(model.id)).toBe(join(installRoot, model.id));
    await expect(readFile(join(installRoot, model.id, "config.json"), "utf8")).resolves.toBe("{}");
    expect(existsSync(join(installRoot, model.id, `${model.id}.zip.download`))).toBe(false);
    expect(existsSync(join(installRoot, model.id, ".extracting"))).toBe(false);
  });

  it("removes temporary archive files when required archive contents are missing", async () => {
    const content = "archive payload";
    const installRoot = await mkdtemp(join(tmpdir(), "topo-model-install-"));
    const model = createArchiveModel(content);
    const job = createFileModelInstallJob({
      installRoot,
      catalog: [model],
      fetch: async () =>
        new Response(content, {
          headers: {
            "content-length": String(Buffer.byteLength(content)),
          },
        }),
      extractArchive: async (_archivePath, targetDirectory) => {
        await mkdir(targetDirectory, { recursive: true });
        await writeFile(join(targetDirectory, "other.json"), "{}");
      },
    });

    await expect(Effect.runPromise(job.start(model.id, () => undefined))).rejects.toThrow(
      "Missing required model file: config.json",
    );

    await expect(readdir(join(installRoot, model.id))).resolves.toEqual([]);
  });

  it("downloads a Hugging Face snapshot into a verified model directory", async () => {
    const installRoot = await mkdtemp(join(tmpdir(), "topo-model-install-"));
    const model = createSnapshotModel();
    const requestedUrls: string[] = [];
    const job = createFileModelInstallJob({
      installRoot,
      catalog: [model],
      fetch: async (url) => {
        requestedUrls.push(String(url));

        if (String(url).includes("/api/models/")) {
          return Response.json([
            {
              type: "file",
              path: "openai_whisper-small/AudioEncoder.mlmodelc/metadata.json",
              size: 2,
            },
          ]);
        }

        return new Response("{}", {
          headers: {
            "content-length": "2",
          },
        });
      },
    });

    await expect(Effect.runPromise(job.start(model.id, () => undefined))).resolves.toMatchObject({
      modelId: model.id,
      status: "installed",
    });

    expect(requestedUrls).toEqual([
      "https://huggingface.co/api/models/argmaxinc/whisperkit-coreml/tree/97a5bf9bbc74c7d9c12c755d04dea59e672e3808/openai_whisper-small?recursive=true",
      "https://huggingface.co/argmaxinc/whisperkit-coreml/resolve/97a5bf9bbc74c7d9c12c755d04dea59e672e3808/openai_whisper-small/AudioEncoder.mlmodelc/metadata.json",
    ]);
    expect(job.getInstalledModelPath(model.id)).toBe(join(installRoot, model.id));
    await expect(
      readFile(join(installRoot, model.id, "AudioEncoder.mlmodelc", "metadata.json"), "utf8"),
    ).resolves.toBe("{}");
    expect(existsSync(join(installRoot, model.id, ".extracting"))).toBe(false);
  });

  it("fails and removes the temp file when verification fails", async () => {
    const installRoot = await mkdtemp(join(tmpdir(), "topo-model-install-"));
    const model = {
      ...createTestModel("expected"),
      checksumSha256: sha256("different"),
    };
    const job = createFileModelInstallJob({
      installRoot,
      catalog: [model],
      fetch: async () =>
        new Response("expected", {
          headers: {
            "content-length": String(Buffer.byteLength("expected")),
          },
        }),
    });

    await expect(Effect.runPromise(job.start(model.id, () => undefined))).rejects.toThrow(
      "checksum-mismatch",
    );
    expect(job.getCurrentProgress()).toMatchObject({
      modelId: model.id,
      status: "failed",
    });
    await expect(readFile(`${installRoot}/test-model/test-model.bin.download`)).rejects.toThrow();
  });

  it("cancels an active download without surfacing an install error", async () => {
    const installRoot = await mkdtemp(join(tmpdir(), "topo-model-install-"));
    const model = createTestModel("expected");
    let sawDownloading = false;
    const job = createFileModelInstallJob({
      installRoot,
      catalog: [model],
      fetch: async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start: (controller) => {
              controller.enqueue(new TextEncoder().encode("exp"));
            },
            cancel: () => undefined,
          }),
          {
            headers: {
              "content-length": String(Buffer.byteLength("expected")),
            },
          },
        ),
    });
    const installPromise = Effect.runPromise(
      job.start(model.id, () => {
        const progress = job.getCurrentProgress();

        if (progress?.status === "downloading" && progress.receivedBytes > 0) {
          sawDownloading = true;
          void Effect.runPromise(job.cancel(model.id));
        }
      }),
    );

    await expect(installPromise).resolves.toMatchObject({
      modelId: model.id,
      status: "canceled",
    });
    expect(sawDownloading).toBe(true);
    await expect(readFile(`${installRoot}/test-model/test-model.bin.download`)).rejects.toThrow();
  });
});
