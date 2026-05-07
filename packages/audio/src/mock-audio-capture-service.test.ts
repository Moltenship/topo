import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { createMockAudioCaptureService } from "./audio-capture-service";

describe("createMockAudioCaptureService", () => {
  it("emits a level frame and returns captured audio", async () => {
    const service = createMockAudioCaptureService();
    const frames: unknown[] = [];

    service.onLevelFrame((frame) => frames.push(frame));

    await Effect.runPromise(service.startRecording("session_1"));
    const audio = await Effect.runPromise(service.stopRecording("hotkey-release"));

    expect(frames).toHaveLength(1);
    expect(audio).toEqual({
      sessionId: "session_1",
      audioPath: "mock://session_1.wav",
      durationMs: 1200,
    });
  });
});
