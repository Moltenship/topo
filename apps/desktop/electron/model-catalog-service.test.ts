import { existsSync } from "node:fs";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import type { ModelCatalogEntry } from "@topo/model-catalog";
import { createModelCatalogService } from "./model-catalog-service";

const createModel = (id: string, displayName: string): ModelCatalogEntry => ({
  id,
  displayName,
  runtime: "whisperkit",
  runtimeRequirement: {
    engine: "whisperkit",
    supportedRuntimeIds: ["whisperkit"],
  },
  platforms: ["macos"],
  architectures: ["arm64"],
  languages: ["en", "ru"],
  source: {
    type: "direct-url",
    url: `https://example.test/${id}.zip`,
  },
  installStrategy: {
    type: "archive-directory",
    requiredFiles: ["config.json"],
  },
  downloadUrl: `https://example.test/${id}.zip`,
  checksumSha256: "0000000000000000000000000000000000000000000000000000000000000001",
  downloadSizeBytes: 10,
  diskSizeBytes: 20,
  estimatedMemoryBytes: 30,
  qualityLabel: "balanced",
  speedLabel: "fast",
  accuracyScore: 72,
  speedScore: 78,
  recommendedReason: "Test fixture.",
  badges: [],
  experimental: false,
});

const createManifest = (models: readonly ModelCatalogEntry[]) => ({
  schemaVersion: 1,
  generatedAt: "2026-05-14T00:00:00.000Z",
  models: models.map(({ downloadUrl: _downloadUrl, ...model }) => model),
});

const createCachePath = async () =>
  join(await mkdtemp(join(tmpdir(), "topo-catalog-")), "cache.json");

describe("createModelCatalogService", () => {
  it("merges a valid remote manifest over the bundled catalog", async () => {
    const cachePath = await createCachePath();
    const bundled = [
      createModel("whisperkit-small", "Bundled Small"),
      createModel("local", "Local"),
    ];
    const remote = createModel("whisperkit-small", "Remote Small");
    const service = createModelCatalogService({
      bundledCatalog: bundled,
      cachePath,
      manifestUrl: "https://example.test/manifest.json",
      fetch: async () => Response.json(createManifest([remote])),
    });

    const catalog = await Effect.runPromise(service.load());

    expect(catalog.map((model) => [model.id, model.displayName])).toEqual([
      ["whisperkit-small", "Remote Small"],
      ["local", "Local"],
    ]);
    await expect(readFile(cachePath, "utf8")).resolves.toContain("Remote Small");
  });

  it("falls back to the cached manifest when the remote manifest is invalid", async () => {
    const cachePath = await createCachePath();
    const bundled = [createModel("whisperkit-small", "Bundled Small")];
    const cached = createModel("whisperkit-small", "Cached Small");
    await writeFile(cachePath, JSON.stringify(createManifest([cached])));
    const service = createModelCatalogService({
      bundledCatalog: bundled,
      cachePath,
      manifestUrl: "https://example.test/manifest.json",
      fetch: async () => Response.json({ schemaVersion: 2, models: [] }),
    });

    const catalog = await Effect.runPromise(service.load());

    expect(catalog[0]?.displayName).toBe("Cached Small");
  });

  it("falls back to bundled catalog when fetch fails and no cache exists", async () => {
    const cachePath = await createCachePath();
    const bundled = [createModel("whisperkit-small", "Bundled Small")];
    const service = createModelCatalogService({
      bundledCatalog: bundled,
      cachePath,
      manifestUrl: "https://example.test/manifest.json",
      fetch: async () => {
        throw new Error("offline");
      },
    });

    const catalog = await Effect.runPromise(service.load());

    expect(catalog).toEqual(bundled);
    expect(existsSync(cachePath)).toBe(false);
  });

  it("uses bundled catalog without fetching when no manifest URL is configured", async () => {
    const cachePath = await createCachePath();
    const bundled = [createModel("whisperkit-small", "Bundled Small")];
    let fetchCalled = false;
    const service = createModelCatalogService({
      bundledCatalog: bundled,
      cachePath,
      manifestUrl: null,
      fetch: async () => {
        fetchCalled = true;
        return Response.json(createManifest([]));
      },
    });

    const catalog = await Effect.runPromise(service.load());

    expect(catalog).toEqual(bundled);
    expect(fetchCalled).toBe(false);
  });
});
