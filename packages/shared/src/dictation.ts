export type RecordingMode = "push-to-talk" | "smart-dictation";
export type StopReason = "hotkey-release" | "silence-timeout" | "manual-cancel";
export type InsertionMode = "paste" | "typing" | "hybrid";
export type InsertionStatus = "inserted" | "failed" | "skipped";
export type OverlayState = "hidden" | "recording" | "processing" | "inserted" | "error";
export type LanguageCode = "en" | "ru" | "auto";

export interface TranscriptRecord {
  readonly id: string;
  readonly text: string;
  readonly createdAt: string;
  readonly durationMs: number;
  readonly modelId: string;
  readonly runtime: string;
  readonly language: LanguageCode;
  readonly recordingMode: RecordingMode;
  readonly stopReason: StopReason;
  readonly insertionMode: InsertionMode;
  readonly insertionStatus: InsertionStatus;
  readonly targetAppName: string | null;
}

export interface LevelFrame {
  readonly sessionId: string;
  readonly timestampMs: number;
  readonly rms: number;
  readonly peak: number;
}
