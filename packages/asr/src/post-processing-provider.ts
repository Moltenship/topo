import type { LanguageModel } from "ai";
import { generateText } from "ai";
import type { PostProcessingRequest } from "@topo/shared";
import { Effect } from "effect";
import { normalizeTranscript } from "./post-processing";

export interface PostProcessingInput extends PostProcessingRequest {}

export interface PostProcessingResult {
  readonly text: string;
  readonly warning: string | null;
}

export type PostProcessingErrorCode = "provider_failed";

export class PostProcessingError extends Error {
  readonly code: PostProcessingErrorCode;
  readonly recoverableResult: PostProcessingResult;

  constructor(code: PostProcessingErrorCode, message: string, recoverableText: string) {
    super(message);
    this.name = "PostProcessingError";
    this.code = code;
    this.recoverableResult = {
      text: recoverableText,
      warning: message,
    };
  }
}

export interface PostProcessingProvider {
  readonly process: (
    input: PostProcessingInput,
  ) => Effect.Effect<PostProcessingResult, PostProcessingError>;
}

export const createLightweightPostProcessingProvider = (): PostProcessingProvider => ({
  process: (input) =>
    Effect.succeed({
      text:
        input.providerId === "lightweight"
          ? normalizeTranscript(input.rawTranscript, "lightweight")
          : input.rawTranscript,
      warning: null,
    }),
});

export interface AiSdkPostProcessingGeneratorInput {
  readonly modelId: string;
  readonly prompt: string;
}

export interface AiSdkPostProcessingProviderOptions {
  readonly model?: (modelId: string) => LanguageModel;
  readonly generate?: (
    input: AiSdkPostProcessingGeneratorInput,
  ) => Promise<{ readonly text: string }>;
}

export const createAiSdkPostProcessingProvider = ({
  generate,
  model,
}: AiSdkPostProcessingProviderOptions): PostProcessingProvider => ({
  process: (input) => {
    if (input.providerId === "lightweight") {
      return Effect.succeed({
        text: normalizeTranscript(input.rawTranscript, "lightweight"),
        warning: null,
      });
    }

    return Effect.tryPromise({
      try: async () => {
        const prompt = buildPostProcessingPrompt(input);
        const result =
          generate !== undefined
            ? await generate({ modelId: input.modelId, prompt })
            : await generateText({
                model: requireModel(model, input.modelId),
                prompt,
              });

        return {
          text: result.text,
          warning: null,
        };
      },
      catch: (error) =>
        new PostProcessingError("provider_failed", getErrorMessage(error), input.rawTranscript),
    });
  },
});

export const buildPostProcessingPrompt = (input: PostProcessingInput): string =>
  [
    "Clean this transcript while preserving the speaker's meaning.",
    `Language: ${input.language}.`,
    `Target schema: ${input.targetSchema}.`,
    "",
    input.rawTranscript,
  ].join("\n");

const requireModel = (
  model: ((modelId: string) => LanguageModel) | undefined,
  modelId: string,
): LanguageModel => {
  if (!model) {
    throw new Error("AI SDK language model factory is not configured.");
  }

  return model(modelId);
};

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
