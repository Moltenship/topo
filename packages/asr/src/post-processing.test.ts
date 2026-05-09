import { describe, expect, it } from "vitest";
import { normalizeTranscript } from "./post-processing";

describe("normalizeTranscript", () => {
  it("keeps raw text unchanged", () => {
    expect(normalizeTranscript("  hello   world  ", "raw")).toBe("  hello   world  ");
  });

  it("trims, collapses whitespace, fixes punctuation spacing, and capitalizes", () => {
    expect(normalizeTranscript("  hello   world  ! ", "lightweight")).toBe("Hello world!");
  });

  it("removes whisper timestamps and joins segments", () => {
    expect(
      normalizeTranscript(
        "[00:00:00.000 --> 00:00:06.680] i check how my voice works.\n[00:00:06.680 --> 00:00:09.760] 123, my name is Timofey.",
        "lightweight",
      ),
    ).toBe("I check how my voice works. 123, my name is Timofey.");
  });

  it("cleans repeated punctuation without breaking normal punctuation", () => {
    expect(normalizeTranscript("hello,,,   world !!!  really??", "lightweight")).toBe(
      "Hello, world! really?",
    );
  });

  it("drops common no-speech hallucinations", () => {
    expect(normalizeTranscript(" you ", "lightweight")).toBe("");
    expect(normalizeTranscript(" thank you ", "lightweight")).toBe("");
  });

  it("drops whisper blank audio markers", () => {
    expect(normalizeTranscript("[BLANK_AUDIO]", "lightweight")).toBe("");
  });

  it("capitalizes standalone english i", () => {
    expect(normalizeTranscript("i think i can test it", "lightweight")).toBe(
      "I think I can test it",
    );
  });
});
