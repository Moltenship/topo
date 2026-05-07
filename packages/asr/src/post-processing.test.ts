import { describe, expect, it } from "vitest";
import { normalizeTranscript } from "./post-processing";

describe("normalizeTranscript", () => {
  it("keeps raw text unchanged", () => {
    expect(normalizeTranscript("  hello   world  ", "raw")).toBe("  hello   world  ");
  });

  it("trims, collapses whitespace, fixes punctuation spacing, and capitalizes", () => {
    expect(normalizeTranscript("  hello   world  ! ", "lightweight")).toBe("Hello world!");
  });
});
