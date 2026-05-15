import { Effect } from "effect";

export interface TranscriptionInput {
  readonly audioPath: string;
  readonly language: "en" | "ru" | "auto";
  readonly modelId: string;
  readonly runtime?: string | null;
  readonly installedModelPath?: string | null;
  readonly runtimeBinaryPath?: string | null;
  readonly fallbackRuntimeBinaryPath?: string | null;
  readonly accelerator?: "auto" | "cpu" | "gpu" | null;
}

export interface TranscriptionResult {
  readonly text: string;
  readonly language: "en" | "ru";
  readonly durationInSeconds: number;
  readonly warnings: readonly string[];
}

export interface TranscriptionProvider {
  readonly transcribe: (input: TranscriptionInput) => Effect.Effect<TranscriptionResult, Error>;
}

export const createMockTranscriptionProvider = (): TranscriptionProvider => ({
  transcribe: (input) =>
    Effect.succeed({
      text: input.language === "ru" ? "privet mir" : "hello world",
      language: input.language === "ru" ? "ru" : "en",
      durationInSeconds: 1.2,
      warnings: [],
    }),
});
