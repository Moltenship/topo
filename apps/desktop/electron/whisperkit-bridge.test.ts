import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { createWhisperKitBridge } from "./whisperkit-bridge";

describe("createWhisperKitBridge", () => {
  it("reports availability from the helper runner", async () => {
    const bridge = createWhisperKitBridge({
      runner: {
        run: async () => ({ success: true, reason: "ready" }),
      },
    });

    await expect(Effect.runPromise(bridge.getAvailability())).resolves.toEqual({
      status: "available",
      reason: "ready",
    });
  });

  it("transcribes through the helper runner", async () => {
    const bridge = createWhisperKitBridge({
      runner: {
        run: async (_command, input) => ({
          success: true,
          reason: "ok",
          text: JSON.stringify(input),
          language: "ru",
          durationInSeconds: 2,
          warnings: [],
        }),
      },
    });

    await expect(
      bridge.transcribe({
        audioPath: "/tmp/audio.wav",
        modelPath: "/models/whisperkit-small",
        language: "ru",
      }),
    ).resolves.toMatchObject({
      text: JSON.stringify({
        audioPath: "/tmp/audio.wav",
        modelPath: "/models/whisperkit-small",
        language: "ru",
      }),
      language: "ru",
    });
  });
});
