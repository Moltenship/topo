import { describe, expect, it } from "vitest";
import * as Schema from "effect/Schema";
import { OverlayState } from "./dictation";

describe("OverlayState", () => {
  it("accepts the non-recording preview state", () => {
    expect(Schema.is(OverlayState)("preview")).toBe(true);
  });
});
