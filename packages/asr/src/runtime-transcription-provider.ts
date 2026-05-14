import { Effect } from "effect";
import type { TranscriptionInput, TranscriptionProvider } from "./transcription-provider";

export const createRuntimeTranscriptionProvider = ({
  whisperCpp,
  whisperKit,
}: {
  readonly whisperCpp: TranscriptionProvider;
  readonly whisperKit: TranscriptionProvider;
}): TranscriptionProvider => ({
  transcribe: (input: TranscriptionInput) => {
    if (input.runtime === "whisperkit") {
      return whisperKit.transcribe(input);
    }

    if (!input.runtime || input.runtime === "whisper-cpp") {
      return whisperCpp.transcribe(input);
    }

    return Effect.fail(new Error(`Unsupported transcription runtime: ${input.runtime}`));
  },
});
