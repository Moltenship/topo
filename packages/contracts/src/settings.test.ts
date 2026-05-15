import * as Schema from "effect/Schema";
import { describe, expect, it } from "vitest";
import { AppSettings, DEFAULT_APP_SETTINGS } from "./settings";

describe("AppSettings", () => {
  it("defaults whisper.cpp accelerator to auto", () => {
    expect(DEFAULT_APP_SETTINGS.whisperCppAccelerator).toBe("auto");
  });

  it.each(["auto", "cpu", "gpu"] as const)("accepts %s whisper.cpp accelerator", (value) => {
    expect(Schema.decodeUnknownSync(AppSettings)({ whisperCppAccelerator: value })).toMatchObject({
      whisperCppAccelerator: value,
    });
  });

  it("rejects unsupported whisper.cpp accelerator values", () => {
    expect(() =>
      Schema.decodeUnknownSync(AppSettings)({ whisperCppAccelerator: "cuda" }),
    ).toThrow();
  });
});
