import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import {
  createMockAppleIntelligenceService,
  createUnavailableAppleIntelligenceService,
} from "./apple-intelligence-service";

describe("AppleIntelligenceService", () => {
  it("returns structured unavailable state and blocks generation", async () => {
    const service = createUnavailableAppleIntelligenceService();

    await expect(Effect.runPromise(service.getAvailability())).resolves.toEqual({
      status: "device-not-eligible",
      reason: "Apple Intelligence is only available on supported macOS devices.",
    });
    await expect(
      Effect.runPromise(service.generateAppleIntelligenceText({ prompt: "clean this" })),
    ).rejects.toThrow("Apple Intelligence is only available on supported macOS devices.");
  });

  it("uses the mock local generator when available", async () => {
    const service = createMockAppleIntelligenceService({
      generate: ({ systemPrompt, prompt, maxTokens }) =>
        `${systemPrompt ?? "system"}:${prompt}:${maxTokens ?? 0}`,
    });

    await expect(
      Effect.runPromise(
        service.generateAppleIntelligenceText({
          systemPrompt: "cleanup",
          prompt: "raw",
          maxTokens: 32,
        }),
      ),
    ).resolves.toBe("cleanup:raw:32");
  });
});
