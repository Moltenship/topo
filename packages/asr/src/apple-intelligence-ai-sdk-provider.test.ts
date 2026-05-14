import { generateText } from "ai";
import { describe, expect, it } from "vitest";
import { appleIntelligence } from "./apple-intelligence-ai-sdk-provider";

describe("appleIntelligence", () => {
  it("adapts generateText calls to the local bridge", async () => {
    const prompts: string[] = [];
    const model = appleIntelligence("default", {
      generate: async ({ prompt }) => {
        prompts.push(prompt);
        return "Cleaned transcript";
      },
    });

    const result = await generateText({
      model,
      prompt: "Clean this transcript: hello",
    });

    expect(result.text).toBe("Cleaned transcript");
    expect(prompts).toEqual(["Clean this transcript: hello"]);
  });
});
