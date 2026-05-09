import * as Effect from "effect/Effect";
import type * as ParseResult from "effect/ParseResult";
import * as Schema from "effect/Schema";

export const RecordingMode = Schema.Literal("toggle-to-talk", "push-to-talk", "smart-dictation");
export type RecordingMode = typeof RecordingMode.Type;

export const StopReason = Schema.Literal("hotkey-release", "silence-timeout", "manual-cancel");
export type StopReason = typeof StopReason.Type;

export const InsertionMode = Schema.Literal("paste", "typing", "hybrid");
export type InsertionMode = typeof InsertionMode.Type;

export const InsertionStatus = Schema.Literal("inserted", "failed", "skipped");
export type InsertionStatus = typeof InsertionStatus.Type;

export const OverlayState = Schema.Literal(
  "hidden",
  "preview",
  "recording",
  "processing",
  "inserted",
  "error",
);
export type OverlayState = typeof OverlayState.Type;

export const LanguageCode = Schema.Literal("en", "ru", "auto");
export type LanguageCode = typeof LanguageCode.Type;

export const TranscriptRecord = Schema.Struct({
  id: Schema.String,
  text: Schema.String,
  createdAt: Schema.String,
  durationMs: Schema.Number,
  modelId: Schema.String,
  runtime: Schema.String,
  language: LanguageCode,
  recordingMode: RecordingMode,
  stopReason: StopReason,
  insertionMode: InsertionMode,
  insertionStatus: InsertionStatus,
  targetAppName: Schema.NullOr(Schema.String),
});
export type TranscriptRecord = typeof TranscriptRecord.Type;

export const LevelFrame = Schema.Struct({
  sessionId: Schema.String,
  timestampMs: Schema.Number,
  rms: Schema.Number,
  peak: Schema.Number,
});
export type LevelFrame = typeof LevelFrame.Type;

export const decodeTranscriptRecord = Schema.decodeUnknown(TranscriptRecord);
export const encodeTranscriptRecord = Schema.encode(TranscriptRecord);

export const makeTranscriptRecord = (
  value: typeof TranscriptRecord.Encoded,
): Effect.Effect<TranscriptRecord, ParseResult.ParseError> => decodeTranscriptRecord(value);
