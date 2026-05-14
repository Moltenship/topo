import { describe, expect, it } from "vitest";
import { bundledModelCatalog } from "./model-catalog";
import { createModelInstallPlan, verifyDownloadedModel } from "./model-installation";

describe("model installation planning", () => {
  it("creates a deterministic install plan from catalog metadata", () => {
    const model = bundledModelCatalog[1];

    if (!model) {
      throw new Error("Expected bundled model catalog entry");
    }

    const plan = createModelInstallPlan(model, "C:/Users/me/AppData/Roaming/Topo/models/");

    expect(plan).toEqual({
      modelId: "whisper-cpp-small",
      downloadUrl:
        "https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-small.bin",
      expectedChecksumSha256: "1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b",
      expectedSizeBytes: model.downloadSizeBytes,
      installDirectory: "C:/Users/me/AppData/Roaming/Topo/models/whisper-cpp-small",
      installStrategy: {
        type: "single-file",
      },
      installedPath:
        "C:/Users/me/AppData/Roaming/Topo/models/whisper-cpp-small/whisper-cpp-small.bin",
      archivePath: null,
      modelFilePath:
        "C:/Users/me/AppData/Roaming/Topo/models/whisper-cpp-small/whisper-cpp-small.bin",
    });
  });

  it("plans snapshot-directory models with the install directory as the installed path", () => {
    const model = bundledModelCatalog[0];

    if (!model) {
      throw new Error("Expected bundled model catalog entry");
    }

    const plan = createModelInstallPlan(model, "/models/");

    expect(plan.installStrategy).toEqual({
      type: "huggingface-snapshot-directory",
      requiredFiles: [
        "AudioEncoder.mlmodelc/metadata.json",
        "MelSpectrogram.mlmodelc/metadata.json",
        "TextDecoder.mlmodelc/metadata.json",
      ],
    });
    expect(plan.installDirectory).toBe("/models/whisperkit-small");
    expect(plan.installedPath).toBe("/models/whisperkit-small");
    expect(plan.archivePath).toBe(null);
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
