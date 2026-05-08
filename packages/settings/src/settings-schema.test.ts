import { describe, expect, it } from "vitest";
import { defaultAppSettings, parseAppSettings } from "./settings-schema";

describe("appSettingsSchema", () => {
  it("creates local-first defaults", () => {
    expect(defaultAppSettings()).toEqual({
      hotkey: "CapsLock",
      recordingMode: "push-to-talk",
      silenceTimeoutMs: null,
      insertionMode: "paste",
      postProcessingMode: "lightweight",
      language: "auto",
      historyEnabled: true,
      autoDeleteHistoryDays: null,
      modelDirectory: null,
      activeModelId: null,
    });
  });

  it("rejects unsupported silence timeout values", () => {
    expect(() => parseAppSettings({ silenceTimeoutMs: 900 })).toThrow();
  });
});
