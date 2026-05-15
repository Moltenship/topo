import { experimental_transcribe as transcribe } from "ai";
import { Effect } from "effect";
import {
  createLocalAiSdkTranscriptionProvider,
  type WhisperCppRunner,
} from "./local-ai-sdk-provider";
import type {
  TranscriptionInput,
  TranscriptionProvider,
  TranscriptionResult,
} from "./transcription-provider";

export const createWhisperCppTranscriptionProvider = ({
  runner,
}: {
  readonly runner?: WhisperCppRunner;
} = {}): TranscriptionProvider => {
  const localProvider =
    runner === undefined
      ? createLocalAiSdkTranscriptionProvider()
      : createLocalAiSdkTranscriptionProvider({ runner });

  return {
    transcribe: (input) =>
      Effect.tryPromise({
        try: () => transcribeWithAiSdk(localProvider, input),
        catch: (error) => (error instanceof Error ? error : new Error(String(error))),
      }),
  };
};

const transcribeWithAiSdk = async (
  localProvider: ReturnType<typeof createLocalAiSdkTranscriptionProvider>,
  input: TranscriptionInput,
): Promise<TranscriptionResult> => {
  const result = await transcribe({
    model: localProvider.transcription(input.modelId),
    audio: new Uint8Array(),
    maxRetries: 0,
    providerOptions: {
      topo: {
        language: input.language,
        installedModelPath: input.installedModelPath ?? null,
        runtimeBinaryPath: input.runtimeBinaryPath ?? null,
        fallbackRuntimeBinaryPath: input.fallbackRuntimeBinaryPath ?? null,
        accelerator: input.accelerator ?? null,
        audioPath: input.audioPath,
      },
    },
  });

  return {
    text: result.text,
    language: result.language === "ru" ? "ru" : "en",
    durationInSeconds: result.durationInSeconds ?? 0,
    warnings: result.warnings.map((warning) => JSON.stringify(warning)),
  };
};
