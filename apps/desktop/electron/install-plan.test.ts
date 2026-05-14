import { describe, expect, it } from "vitest";
import type { InstalledModelRecord, InstalledRuntimeRecord } from "@topo/shared";
import { bundledModelCatalog, bundledRuntimeCatalog } from "@topo/model-catalog";
import { createInstallPlan } from "./install-plan";

const installedModel = (
  modelId: string,
  verificationStatus = "verified",
): InstalledModelRecord => ({
  id: `installed_${modelId}`,
  modelId,
  runtime: "whisper-cpp",
  sourceType: "huggingface-file",
  sourceRevision: "main",
  installedPath: `/models/${modelId}.bin`,
  checksumSha256: "sha",
  verificationStatus: verificationStatus as InstalledModelRecord["verificationStatus"],
  installedAt: "2026-05-14T00:00:00.000Z",
});

const installedRuntime = (
  runtimeId: InstalledRuntimeRecord["runtimeId"],
  verificationStatus = "verified",
): InstalledRuntimeRecord => ({
  id: `installed_${runtimeId}`,
  runtimeId,
  engine: runtimeId === "whisperkit" ? "whisperkit" : "whisper-cpp",
  installedPath: `/runtimes/${runtimeId}`,
  binaryPath: runtimeId === "whisperkit" ? null : `/runtimes/${runtimeId}/whisper-cli.exe`,
  checksumSha256: "sha",
  verificationStatus: verificationStatus as InstalledRuntimeRecord["verificationStatus"],
  installedAt: "2026-05-14T00:00:00.000Z",
  lastProbedAt: "2026-05-14T00:00:00.000Z",
  lastProbeMessage: "ok",
});

describe("createInstallPlan", () => {
  it("selects the matching Windows runtime and installs both missing artifacts", () => {
    const plan = createInstallPlan({
      modelId: "whisper-cpp-small",
      platform: "windows",
      architecture: "x64",
      modelCatalog: bundledModelCatalog,
      runtimeCatalog: bundledRuntimeCatalog,
      installedModels: [],
      installedRuntimes: [],
    });

    expect(plan).toMatchObject({
      modelId: "whisper-cpp-small",
      runtimeId: "whisper-cpp-windows-x64",
      installRuntime: true,
      installModel: true,
    });
  });

  it("skips verified runtime and model artifacts", () => {
    const plan = createInstallPlan({
      modelId: "whisper-cpp-small",
      platform: "windows",
      architecture: "x64",
      modelCatalog: bundledModelCatalog,
      runtimeCatalog: bundledRuntimeCatalog,
      installedModels: [installedModel("whisper-cpp-small")],
      installedRuntimes: [installedRuntime("whisper-cpp-windows-x64")],
    });

    expect(plan.installRuntime).toBe(false);
    expect(plan.installModel).toBe(false);
  });

  it("repairs only corrupt artifacts", () => {
    const plan = createInstallPlan({
      modelId: "whisper-cpp-small",
      platform: "windows",
      architecture: "x64",
      modelCatalog: bundledModelCatalog,
      runtimeCatalog: bundledRuntimeCatalog,
      installedModels: [installedModel("whisper-cpp-small", "corrupt")],
      installedRuntimes: [installedRuntime("whisper-cpp-windows-x64")],
    });

    expect(plan.installRuntime).toBe(false);
    expect(plan.installModel).toBe(true);
  });

  it("uses the system WhisperKit runtime on Apple Silicon", () => {
    const plan = createInstallPlan({
      modelId: "whisperkit-small",
      platform: "macos",
      architecture: "arm64",
      modelCatalog: bundledModelCatalog,
      runtimeCatalog: bundledRuntimeCatalog,
      installedModels: [],
      installedRuntimes: [],
    });

    expect(plan.runtimeId).toBe("whisperkit");
    expect(plan.installRuntime).toBe(true);
    expect(plan.installModel).toBe(true);
  });
});
