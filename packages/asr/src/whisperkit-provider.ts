import { Effect } from "effect";
import type {
  TranscriptionInput,
  TranscriptionProvider,
  TranscriptionResult,
} from "./transcription-provider";

export interface WhisperKitTranscriptionRequest {
  readonly audioPath: string;
  readonly modelPath: string;
  readonly language: "en" | "ru" | "auto";
}

export interface WhisperKitTranscriptionBridge {
  readonly transcribe: (
    request: WhisperKitTranscriptionRequest,
  ) => Promise<WhisperKitTranscriptionResult>;
}

export interface WhisperKitTranscriptionResult {
  readonly text: string;
  readonly language: "en" | "ru";
  readonly durationInSeconds?: number | null;
  readonly warnings?: readonly string[];
}

export const createWhisperKitTranscriptionProvider = ({
  bridge,
}: {
  readonly bridge: WhisperKitTranscriptionBridge;
}): TranscriptionProvider => ({
  transcribe: (input) =>
    Effect.tryPromise({
      try: () => transcribeWithBridge(bridge, input),
      catch: (error) => (error instanceof Error ? error : new Error(String(error))),
    }),
});

const transcribeWithBridge = async (
  bridge: WhisperKitTranscriptionBridge,
  input: TranscriptionInput,
): Promise<TranscriptionResult> => {
  if (!input.installedModelPath) {
    throw new Error("model_not_installed");
  }

  const result = await bridge.transcribe({
    audioPath: input.audioPath,
    modelPath: input.installedModelPath,
    language: input.language,
  });

  return {
    text: result.text,
    language: result.language,
    durationInSeconds: result.durationInSeconds ?? 0,
    warnings: result.warnings ?? [],
  };
};
