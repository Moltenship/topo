import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { AppStateSnapshot } from "./ipc";

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
      errorMessage: null,
    });

    expect(decoded.installedRuntimes).toEqual([]);
    expect(decoded.runtimeInstallProgress).toBeNull();
  });
});
