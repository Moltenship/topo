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
      postProcessingPrompt:
        "Clean this transcript while preserving the speaker's meaning. Fix casing, punctuation, filler artifacts, and obvious transcription spacing. Return only the cleaned transcript.",
      postProcessingApiProvider: null,
      language: "auto",
      historyEnabled: true,
      saveTranscriptAudio: false,
      whisperCppAccelerator: "auto",
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

  it("accepts a custom post-processing prompt", () => {
    expect(
      parseAppSettings({ postProcessingPrompt: "Return concise text." }).postProcessingPrompt,
    ).toBe("Return concise text.");
  });

  it.each(["auto", "cpu", "gpu"] as const)("accepts %s whisper.cpp accelerator", (value) => {
    expect(parseAppSettings({ whisperCppAccelerator: value }).whisperCppAccelerator).toBe(value);
  });

  it("rejects unsupported whisper.cpp accelerators", () => {
    expect(() => parseAppSettings({ whisperCppAccelerator: "cuda" })).toThrow();
  });

  it("rejects unsupported silence timeout values", () => {
    expect(() => parseAppSettings({ silenceTimeoutMs: 900 })).toThrow();
  });

  it("rejects unsupported overlay positions", () => {
    expect(() => parseAppSettings({ overlayPosition: "somewhere" })).toThrow();
  });
});
