import { describe, expect, it } from "vitest";
import type { ModelCatalogEntry } from "@topo/model-catalog";
import type { InstalledModelRecord } from "@topo/shared";
import { getModelSourceRevision, isInstalledModelOutdated } from "./model-artifact-revision";

const model = {
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
    type: "github-release",
    owner: "topo-app",
    repo: "topo-models",
    tag: "whisperkit-small-2026-05-14",
    assetName: "whisperkit-small.zip",
  },
  installStrategy: {
    type: "archive-directory",
    requiredFiles: ["config.json"],
  },
  downloadUrl:
    "https://github.com/topo-app/topo-models/releases/download/whisperkit-small-2026-05-14/whisperkit-small.zip",
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
} satisfies ModelCatalogEntry;

const installed = {
  id: "installed_whisperkit-small",
  modelId: "whisperkit-small",
  runtime: "whisperkit",
  sourceType: "github-release",
  sourceRevision: "whisperkit-small-2026-05-14",
  installedPath: "/models/whisperkit-small",
  checksumSha256: "0000000000000000000000000000000000000000000000000000000000000001",
  verificationStatus: "verified",
  installedAt: "2026-05-14T00:00:00.000Z",
} satisfies InstalledModelRecord;

describe("model artifact revision helpers", () => {
  it("uses release tags as source revisions", () => {
    expect(getModelSourceRevision(model)).toBe("whisperkit-small-2026-05-14");
  });

  it("detects matching installed artifacts as current", () => {
    expect(isInstalledModelOutdated(installed, model)).toBe(false);
  });

  it("detects source revision changes", () => {
    expect(
      isInstalledModelOutdated(
        {
          ...installed,
          sourceRevision: "whisperkit-small-2026-04-01",
        },
        model,
      ),
    ).toBe(true);
  });

  it("detects checksum changes", () => {
    expect(
      isInstalledModelOutdated(
        {
          ...installed,
          checksumSha256: "0000000000000000000000000000000000000000000000000000000000000002",
        },
        model,
      ),
    ).toBe(true);
  });
});
