import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { createMockTranscriptionProvider } from "./transcription-provider";

describe("createMockTranscriptionProvider", () => {
  it("returns deterministic Russian text for Russian input", async () => {
    const provider = createMockTranscriptionProvider();

    await expect(
      Effect.runPromise(
        provider.transcribe({
          audioPath: "mock://session.wav",
          language: "ru",
          modelId: "whisper-cpp-small",
        }),
      ),
    ).resolves.toMatchObject({
      text: "privet mir",
      language: "ru",
    });
  });
});
