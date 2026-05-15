import { describe, expect, it } from "vitest";
import { defaultAppSettings, parseAppSettings } from "./settings-schema";

describe("appSettingsSchema", () => {
  it("creates local-first defaults", () => {
    expect(defaultAppSettings()).toEqual({
      hotkey: "CapsLock",
      recordingMode: "toggle-to-talk",
      silenceTimeoutMs: null,
      insertionMode: "paste",
      postProcessingMode: "lightweight",
      postProcessingApiProvider: null,
      language: "auto",
      historyEnabled: true,
      saveTranscriptAudio: false,
      autoDeleteHistoryDays: null,
      modelDirectory: null,
      activeModelId: null,
      microphoneDeviceId: null,
      overlayPosition: "bottom-center",
    });
  });

  it("accepts a selected microphone device id", () => {
    expect(parseAppSettings({ microphoneDeviceId: "default" }).microphoneDeviceId).toBe("default");
  });

  it("accepts a selected overlay position", () => {
    expect(parseAppSettings({ overlayPosition: "top-center" }).overlayPosition).toBe("top-center");
  });

  it("accepts transcript audio saving preference", () => {
    expect(parseAppSettings({ saveTranscriptAudio: true }).saveTranscriptAudio).toBe(true);
  });

  it("rejects unsupported silence timeout values", () => {
    expect(() => parseAppSettings({ silenceTimeoutMs: 900 })).toThrow();
  });

  it("rejects unsupported overlay positions", () => {
    expect(() => parseAppSettings({ overlayPosition: "somewhere" })).toThrow();
  });
});
