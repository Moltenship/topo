import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { AppStateSnapshot } from "./ipc";
import { InstallBundleProgress } from "./model-installation";

describe("AppStateSnapshot", () => {
  it("includes installed runtimes and runtime install progress", () => {
    const decoded = Schema.decodeUnknownSync(AppStateSnapshot)({
      setupComplete: false,
      overlayState: "hidden",
      settings: {
        hotkey: "CapsLock",
        recordingMode: "toggle-to-talk",
        activeModelId: "whisperkit-small",
      },
      transcripts: [],
      installedModels: [],
      installedRuntimes: [],
      modelReadiness: [],
      modelInstallProgress: null,
      runtimeInstallProgress: null,
      bundleInstallProgress: null,
      errorMessage: null,
    });

    expect(decoded.installedRuntimes).toEqual([]);
    expect(decoded.runtimeInstallProgress).toBeNull();
  });
});

describe("InstallBundleProgress", () => {
  it("decodes bundle progress with child runtime and model progress", () => {
    const decoded = Schema.decodeUnknownSync(InstallBundleProgress)({
      modelId: "whisper-cpp-small",
      runtimeId: "whisper-cpp-windows-x64",
      stage: "runtime",
      runtimeProgress: {
        modelId: "whisper-cpp-windows-x64",
        status: "downloading",
        receivedBytes: 1,
        totalBytes: 2,
        percent: 0.5,
        errorMessage: null,
      },
      modelProgress: null,
      errorMessage: null,
    });

    expect(decoded.runtimeId).toBe("whisper-cpp-windows-x64");
    expect(decoded.stage).toBe("runtime");
  });
});
