import * as Schema from "effect/Schema";
import { LanguageCode } from "./dictation";

export const PostProcessingMode = Schema.Literal("raw", "lightweight", "apple-intelligence", "api");
export type PostProcessingMode = typeof PostProcessingMode.Type;

export const ApiPostProcessingProvider = Schema.Literal(
  "openai",
  "openrouter",
  "custom-openai-compatible",
);
export type ApiPostProcessingProvider = typeof ApiPostProcessingProvider.Type;

export const PostProcessingProviderId = Schema.Union(
  Schema.Literal("lightweight", "apple-intelligence"),
  ApiPostProcessingProvider,
);
export type PostProcessingProviderId = typeof PostProcessingProviderId.Type;

export const PostProcessingTargetSchema = Schema.Literal("plain-text");
export type PostProcessingTargetSchema = typeof PostProcessingTargetSchema.Type;

export const ApiPostProcessingSettings = Schema.Struct({
  providerId: ApiPostProcessingProvider,
  modelId: Schema.String,
  baseUrl: Schema.optionalWith(Schema.NullOr(Schema.String), { default: () => null }),
  apiKeyStorageKey: Schema.optionalWith(Schema.NullOr(Schema.String), { default: () => null }),
});
export type ApiPostProcessingSettings = typeof ApiPostProcessingSettings.Type;

export const PostProcessingRequest = Schema.Struct({
  rawTranscript: Schema.String,
  language: LanguageCode,
  promptId: Schema.String,
  providerId: PostProcessingProviderId,
  modelId: Schema.String,
  targetSchema: PostProcessingTargetSchema,
});
export type PostProcessingRequest = typeof PostProcessingRequest.Type;
