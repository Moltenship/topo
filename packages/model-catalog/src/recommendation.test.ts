import { describe, expect, it } from "vitest";
import { bundledModelCatalog } from "./model-catalog";
import { recommendModel } from "./recommendation";

describe("recommendModel", () => {
  it("recommends WhisperKit on Apple Silicon", () => {
    const result = recommendModel(bundledModelCatalog, {
      platform: "macos",
      architecture: "arm64",
      memoryBytes: 8 * 1024 * 1024 * 1024,
      hasNvidiaGpu: false,
    });

    expect(result.recommended?.runtime).toBe("whisperkit");
  });

  it("recommends stable whisper.cpp over experimental Parakeet on Windows", () => {
    const result = recommendModel(bundledModelCatalog, {
      platform: "windows",
      architecture: "x64",
      memoryBytes: 8 * 1024 * 1024 * 1024,
      hasNvidiaGpu: true,
    });

    expect(result.recommended?.runtime).toBe("whisper-cpp");
  });
});
