import { describe, expect, it } from "vitest";
import { bundledModelCatalog } from "./model-catalog";
import { createModelInstallPlan, verifyDownloadedModel } from "./model-installation";

describe("model installation planning", () => {
  it("creates a deterministic install plan from catalog metadata", () => {
    const model = bundledModelCatalog[1];

    if (!model) {
      throw new Error("Expected bundled model catalog entry");
    }

    const plan = createModelInstallPlan(model, "C:/Users/me/AppData/Roaming/Molten Voice/models/");

    expect(plan).toEqual({
      modelId: "whisper-cpp-small",
      downloadUrl: "https://example.invalid/models/whisper-cpp-small",
      expectedChecksumSha256: "0000000000000000000000000000000000000000000000000000000000000002",
      expectedSizeBytes: model.downloadSizeBytes,
      installDirectory: "C:/Users/me/AppData/Roaming/Molten Voice/models/whisper-cpp-small",
      modelFilePath:
        "C:/Users/me/AppData/Roaming/Molten Voice/models/whisper-cpp-small/whisper-cpp-small.bin",
    });
  });

  it("verifies size and checksum before marking a model installed", () => {
    const model = bundledModelCatalog[0];

    if (!model) {
      throw new Error("Expected bundled model catalog entry");
    }

    const plan = createModelInstallPlan(model, "/models");

    expect(verifyDownloadedModel(plan, null)).toEqual({
      status: "not-installed",
      reason: "missing",
    });
    expect(
      verifyDownloadedModel(plan, {
        path: plan.modelFilePath,
        sizeBytes: model.downloadSizeBytes - 1,
        checksumSha256: model.checksumSha256,
      }),
    ).toEqual({ status: "corrupt", reason: "size-mismatch" });
    expect(
      verifyDownloadedModel(plan, {
        path: plan.modelFilePath,
        sizeBytes: model.downloadSizeBytes,
        checksumSha256: "bad",
      }),
    ).toEqual({ status: "corrupt", reason: "checksum-mismatch" });
    expect(
      verifyDownloadedModel(plan, {
        path: plan.modelFilePath,
        sizeBytes: model.downloadSizeBytes,
        checksumSha256: model.checksumSha256,
      }),
    ).toEqual({ status: "installed", reason: "ok" });
  });
});
