import { describe, expect, it } from "vitest";
import { DEFAULT_APP_SETTINGS, canStartDictation } from "./index";
import type { ModelReadinessRecord } from "./installed-model";

const readyModel = (modelId: string): ModelReadinessRecord => ({
  modelId,
  status: "ready",
  lamp: "green",
  message: "ready",
  runtimeBinaryPath: "C:/tools/whisper-cli.exe",
  checkedAt: "2026-05-14T00:00:00.000Z",
});

describe("canStartDictation", () => {
  it("requires an active ready model", () => {
    expect(
      canStartDictation({
        settings: { ...DEFAULT_APP_SETTINGS, activeModelId: null },
        modelReadiness: [readyModel("whisper-cpp-small")],
      }),
    ).toBe(false);

    expect(
      canStartDictation({
        settings: { ...DEFAULT_APP_SETTINGS, activeModelId: "whisper-cpp-small" },
        modelReadiness: [],
      }),
    ).toBe(false);

    expect(
      canStartDictation({
        settings: { ...DEFAULT_APP_SETTINGS, activeModelId: "whisper-cpp-small" },
        modelReadiness: [{ ...readyModel("whisper-cpp-small"), status: "not-installed" }],
      }),
    ).toBe(false);

    expect(
      canStartDictation({
        settings: { ...DEFAULT_APP_SETTINGS, activeModelId: "whisper-cpp-small" },
        modelReadiness: [readyModel("different-model")],
      }),
    ).toBe(false);

    expect(
      canStartDictation({
        settings: { ...DEFAULT_APP_SETTINGS, activeModelId: "whisper-cpp-small" },
        modelReadiness: [readyModel("whisper-cpp-small")],
      }),
    ).toBe(true);
  });
});
