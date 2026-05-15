import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import {
  createAiSdkPostProcessingProvider,
  createLightweightPostProcessingProvider,
  PostProcessingError,
} from "./post-processing-provider";

describe("post-processing providers", () => {
  const input = {
    rawTranscript: "  hello   world  ! ",
    language: "en",
    promptId: "default-cleanup",
    prompt: "Clean the transcript.",
    providerId: "lightweight",
    modelId: "local",
    targetSchema: "plain-text",
  } as const;

  it("normalizes text with the lightweight provider", async () => {
    const provider = createLightweightPostProcessingProvider();

    await expect(Effect.runPromise(provider.process(input))).resolves.toEqual({
      text: "Hello world!",
      warning: null,
    });
  });

  it("wraps AI SDK generation as a recoverable post-processing result", async () => {
    const provider = createAiSdkPostProcessingProvider({
      generate: async ({ prompt }) => ({ text: `cleaned:${prompt.includes(input.rawTranscript)}` }),
    });

    await expect(
      Effect.runPromise(
        provider.process({
          ...input,
          providerId: "apple-intelligence",
          modelId: "default",
        }),
      ),
    ).resolves.toEqual({
      text: "cleaned:true",
      warning: null,
    });
  });

  it("uses the selected prompt as the AI SDK system prompt", async () => {
    const requests: { readonly system: string; readonly prompt: string }[] = [];
    const provider = createAiSdkPostProcessingProvider({
      generate: async ({ system, prompt }) => {
        requests.push({ system, prompt });
        return { text: "cleaned" };
      },
    });

    await Effect.runPromise(
      provider.process({
        ...input,
        prompt: "Rewrite as a status update.",
        providerId: "openai",
        modelId: "gpt-5.4-mini",
      }),
    );

    expect(requests[0]?.system).toBe("Rewrite as a status update.");
    expect(requests[0]?.prompt).not.toContain("Rewrite as a status update.");
    expect(requests[0]?.prompt).toContain(input.rawTranscript);
  });

  it("preserves the raw transcript when AI processing fails", async () => {
    const provider = createAiSdkPostProcessingProvider({
      generate: async () => {
        throw new Error("provider unavailable");
      },
    });

    const error = await Effect.runPromise(
      provider
        .process({
          ...input,
          providerId: "openai",
          modelId: "gpt-5.4-mini",
        })
        .pipe(Effect.flip),
    );

    expect(error).toMatchObject({
      code: "provider_failed",
      recoverableResult: {
        text: input.rawTranscript,
        warning: "provider unavailable",
      },
    } satisfies Partial<PostProcessingError>);
  });
});
