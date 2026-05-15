import { generateText } from "ai";
import { describe, expect, it } from "vitest";
import { appleIntelligence } from "./apple-intelligence-ai-sdk-provider";

describe("appleIntelligence", () => {
  it("adapts generateText calls to the local bridge", async () => {
    const prompts: { readonly prompt: string; readonly systemPrompt?: string }[] = [];
    const model = appleIntelligence("default", {
      generate: async ({ prompt, systemPrompt }) => {
        prompts.push({ prompt, ...(systemPrompt ? { systemPrompt } : {}) });
        return "Cleaned transcript";
      },
    });

    const result = await generateText({
      model,
      prompt: "Clean this transcript: hello",
    });

    expect(result.text).toBe("Cleaned transcript");
    expect(prompts).toEqual([{ prompt: "Clean this transcript: hello" }]);
  });

  it("passes AI SDK system prompts to the local bridge separately", async () => {
    const prompts: { readonly prompt: string; readonly systemPrompt?: string }[] = [];
    const model = appleIntelligence("default", {
      generate: async ({ prompt, systemPrompt }) => {
        prompts.push({ prompt, ...(systemPrompt ? { systemPrompt } : {}) });
        return "Cleaned transcript";
      },
    });

    const result = await generateText({
      model,
      system: "Preserve meaning and fix punctuation.",
      prompt: "hello world",
    });

    expect(result.text).toBe("Cleaned transcript");
    expect(prompts).toEqual([
      {
        systemPrompt: "Preserve meaning and fix punctuation.",
        prompt: "hello world",
      },
    ]);
  });
});
