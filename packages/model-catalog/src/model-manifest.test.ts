import * as Schema from "effect/Schema";
import { describe, expect, it } from "vitest";
import { ModelCatalogManifest, modelCatalogManifestToCatalog } from "./model-manifest";

const validManifest = {
  schemaVersion: 1,
  generatedAt: "2026-05-14T00:00:00.000Z",
  models: [
    {
      id: "whisperkit-small",
      displayName: "WhisperKit Small",
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
        url: "https://example.invalid/models/whisperkit-small.zip",
      },
      installStrategy: {
        type: "archive-directory",
        requiredFiles: ["config.json"],
      },
      checksumSha256: "0000000000000000000000000000000000000000000000000000000000000001",
      downloadSizeBytes: 536870912,
      diskSizeBytes: 1288490189,
      estimatedMemoryBytes: 1932735283,
      qualityLabel: "balanced",
      speedLabel: "fast",
      accuracyScore: 72,
      speedScore: 78,
      recommendedReason: "Recommended for Apple Silicon because it balances latency and accuracy.",
      badges: ["recommended"],
      experimental: false,
    },
  ],
};

describe("ModelCatalogManifest", () => {
  it("decodes a valid v1 manifest", () => {
    const decoded = Schema.decodeUnknownSync(ModelCatalogManifest)(validManifest);

    expect(decoded.schemaVersion).toBe(1);
    expect(decoded.models[0]?.installStrategy).toEqual({
      type: "archive-directory",
      requiredFiles: ["config.json"],
    });
  });

  it("rejects unsupported schema versions", () => {
    expect(() =>
      Schema.decodeUnknownSync(ModelCatalogManifest)({
        ...validManifest,
        schemaVersion: 2,
      }),
    ).toThrow();
  });

  it("rejects models without checksums", () => {
    const [model] = validManifest.models;

    if (!model) {
      throw new Error("Expected manifest model");
    }

    const { checksumSha256: _checksumSha256, ...modelWithoutChecksum } = model;

    expect(() =>
      Schema.decodeUnknownSync(ModelCatalogManifest)({
        ...validManifest,
        models: [modelWithoutChecksum],
      }),
    ).toThrow();
  });

  it("converts manifest models to catalog entries", () => {
    const manifest = Schema.decodeUnknownSync(ModelCatalogManifest)(validManifest);
    const catalog = modelCatalogManifestToCatalog(manifest);

    expect(catalog).toHaveLength(1);
    expect(catalog[0]).toMatchObject({
      id: "whisperkit-small",
      runtime: "whisperkit",
      downloadUrl: "https://example.invalid/models/whisperkit-small.zip",
      installStrategy: {
        type: "archive-directory",
        requiredFiles: ["config.json"],
      },
    });
  });
});
