import { describe, expect, it } from "vitest";
import * as Schema from "effect/Schema";
import { OverlayState, TranscriptRecord } from "./dictation";

type IsEqual<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Assert<T extends true> = T;

type _TranscriptAudioFileNameIsRequiredNullable = Assert<
  IsEqual<TranscriptRecord["audioFileName"], string | null>
>;
type _TranscriptAudioMimeTypeIsRequiredNullable = Assert<
  IsEqual<TranscriptRecord["audioMimeType"], string | null>
>;
type _TranscriptAudioByteSizeIsRequiredNullable = Assert<
  IsEqual<TranscriptRecord["audioByteSize"], number | null>
>;

describe("OverlayState", () => {
  it("accepts the non-recording preview state", () => {
    expect(Schema.is(OverlayState)("preview")).toBe(true);
  });
});

describe("TranscriptRecord", () => {
  it("defaults audio metadata to null", () => {
    const decoded = Schema.decodeUnknownSync(TranscriptRecord)({
      id: "tr_1",
      text: "hello",
      createdAt: "2026-05-15T00:00:00.000Z",
      durationMs: 1000,
      modelId: "model",
      runtime: "whisper-cpp",
      language: "en",
      recordingMode: "toggle-to-talk",
      stopReason: "hotkey-release",
      insertionMode: "paste",
      insertionStatus: "inserted",
      targetAppName: null,
    });

    expect(decoded.audioFileName).toBeNull();
    expect(decoded.audioMimeType).toBeNull();
    expect(decoded.audioByteSize).toBeNull();
  });

  it("decodes populated audio metadata", () => {
    const decoded = Schema.decodeUnknownSync(TranscriptRecord)({
      id: "tr_2",
      text: "hello",
      createdAt: "2026-05-15T00:00:00.000Z",
      durationMs: 1000,
      modelId: "model",
      runtime: "whisper-cpp",
      language: "en",
      recordingMode: "toggle-to-talk",
      stopReason: "hotkey-release",
      insertionMode: "paste",
      insertionStatus: "inserted",
      targetAppName: null,
      audioFileName: "tr_2.wav",
      audioMimeType: "audio/wav",
      audioByteSize: 48,
    });

    expect(decoded.audioFileName).toBe("tr_2.wav");
    expect(decoded.audioMimeType).toBe("audio/wav");
    expect(decoded.audioByteSize).toBe(48);
  });
});
