import { createMockAudioCaptureService } from "@molten-voice/audio";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { createDictationOrchestrator } from "./dictation-orchestrator";
import { createMockTranscriptionProvider } from "./transcription-provider";

describe("createDictationOrchestrator", () => {
  it("records, transcribes, normalizes, and returns a transcript record", async () => {
    const ids = ["session_1", "transcript_1"];
    const orchestrator = createDictationOrchestrator({
      audio: createMockAudioCaptureService(),
      transcription: createMockTranscriptionProvider(),
      now: () => new Date("2026-05-07T00:00:00.000Z"),
      createId: () => ids.shift() ?? "fallback",
    });

    const transcript = await Effect.runPromise(
      Effect.gen(function* () {
        yield* orchestrator.start();
        return yield* orchestrator.stop({
          language: "en",
          modelId: "whisper-cpp-small",
          runtime: "whisper-cpp",
          postProcessingMode: "lightweight",
        });
      }),
    );

    expect(transcript).toMatchObject({
      id: "transcript_1",
      text: "Hello world",
      createdAt: "2026-05-07T00:00:00.000Z",
      durationMs: 1200,
      insertionStatus: "skipped",
    });
  });
});
