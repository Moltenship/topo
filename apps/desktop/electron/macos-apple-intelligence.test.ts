import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { createMacosAppleIntelligenceService } from "./macos-apple-intelligence";

describe("createMacosAppleIntelligenceService", () => {
  it("marks non-macOS devices as ineligible", async () => {
    const service = createMacosAppleIntelligenceService({ platform: "win32" });

    await expect(Effect.runPromise(service.getAvailability())).resolves.toEqual({
      status: "device-not-eligible",
      reason: "Apple Intelligence is only available on supported macOS devices.",
    });
  });

  it("marks macOS without a helper bridge as not ready", async () => {
    const service = createMacosAppleIntelligenceService({ platform: "darwin" });

    await expect(Effect.runPromise(service.getAvailability())).resolves.toEqual({
      status: "model-not-ready",
      reason: "The local Apple Intelligence bridge is not installed or ready.",
    });
  });

  it("generates through the local macOS bridge when available", async () => {
    const service = createMacosAppleIntelligenceService({
      platform: "darwin",
      bridge: {
        generate: async ({ systemPrompt, prompt, maxTokens }) =>
          `${systemPrompt ?? "system"}:${prompt}:${maxTokens ?? 0}`,
      },
    });

    await expect(Effect.runPromise(service.getAvailability())).resolves.toEqual({
      status: "available",
      reason: "Apple Intelligence is available through the local macOS bridge.",
    });
    await expect(
      Effect.runPromise(
        service.generateAppleIntelligenceText({
          systemPrompt: "cleanup",
          prompt: "raw",
          maxTokens: 16,
        }),
      ),
    ).resolves.toBe("cleanup:raw:16");
  });

  it("uses bridge availability when the helper can report system readiness", async () => {
    const service = createMacosAppleIntelligenceService({
      platform: "darwin",
      bridge: {
        getAvailability: () =>
          Effect.succeed({
            status: "apple-intelligence-disabled",
            reason: "Apple Intelligence is disabled in macOS settings.",
          }),
        generate: async () => "unused",
      },
    });

    await expect(Effect.runPromise(service.getAvailability())).resolves.toEqual({
      status: "apple-intelligence-disabled",
      reason: "Apple Intelligence is disabled in macOS settings.",
    });
  });
});
