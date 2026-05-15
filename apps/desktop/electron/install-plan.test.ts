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
  it("plans CUDA plus CPU fallback for auto Windows whisper.cpp installs", () => {
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
      runtimeId: "whisper-cpp-windows-x64-cuda",
      installRuntime: true,
      installModel: true,
    });
    expect(plan.runtimeIds).toEqual([
      "whisper-cpp-windows-x64-cpu",
      "whisper-cpp-windows-x64-cuda",
    ]);
    expect(plan.runtimeInstallQueue.map((entry) => [entry.runtime.id, entry.required])).toEqual([
      ["whisper-cpp-windows-x64-cpu", true],
      ["whisper-cpp-windows-x64-cuda", false],
    ]);
  });

  it("plans only CPU runtime when CPU acceleration is selected", () => {
    const plan = createInstallPlan({
      modelId: "whisper-cpp-small",
      platform: "windows",
      architecture: "x64",
      modelCatalog: bundledModelCatalog,
      runtimeCatalog: bundledRuntimeCatalog,
      installedModels: [],
      installedRuntimes: [],
      whisperCppAccelerator: "cpu",
    });

    expect(plan.runtimeId).toBe("whisper-cpp-windows-x64-cpu");
    expect(plan.runtimeIds).toEqual(["whisper-cpp-windows-x64-cpu"]);
    expect(plan.runtimeInstallQueue.map((entry) => [entry.runtime.id, entry.required])).toEqual([
      ["whisper-cpp-windows-x64-cpu", true],
    ]);
  });

  it("plans CUDA plus required CPU fallback when GPU acceleration is selected", () => {
    const plan = createInstallPlan({
      modelId: "whisper-cpp-small",
      platform: "windows",
      architecture: "x64",
      modelCatalog: bundledModelCatalog,
      runtimeCatalog: bundledRuntimeCatalog,
      installedModels: [],
      installedRuntimes: [],
      whisperCppAccelerator: "gpu",
    });

    expect(plan.runtimeId).toBe("whisper-cpp-windows-x64-cuda");
    expect(plan.runtimeIds).toEqual([
      "whisper-cpp-windows-x64-cpu",
      "whisper-cpp-windows-x64-cuda",
    ]);
    expect(plan.runtimeInstallQueue.map((entry) => [entry.runtime.id, entry.required])).toEqual([
      ["whisper-cpp-windows-x64-cpu", true],
      ["whisper-cpp-windows-x64-cuda", true],
    ]);
  });

  it("skips verified runtime and model artifacts", () => {
    const plan = createInstallPlan({
      modelId: "whisper-cpp-small",
      platform: "windows",
      architecture: "x64",
      modelCatalog: bundledModelCatalog,
      runtimeCatalog: bundledRuntimeCatalog,
      installedModels: [installedModel("whisper-cpp-small")],
      installedRuntimes: [
        installedRuntime("whisper-cpp-windows-x64-cpu"),
        installedRuntime("whisper-cpp-windows-x64-cuda"),
      ],
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
      installedRuntimes: [
        installedRuntime("whisper-cpp-windows-x64-cpu"),
        installedRuntime("whisper-cpp-windows-x64-cuda"),
      ],
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
