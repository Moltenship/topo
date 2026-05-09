import { Effect } from "effect";
import { readFile, stat } from "node:fs/promises";
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
    expect(audio.sessionId).toBe("session_1");
    expect(audio.durationMs).toBe(1200);
    expect(audio.audioPath.endsWith("session_1.wav")).toBe(true);

    const audioStat = await stat(audio.audioPath);
    expect(audioStat.isFile()).toBe(true);

    const header = await readFile(audio.audioPath, { encoding: "ascii" });
    expect(header.slice(0, 4)).toBe("RIFF");
    expect(header.slice(8, 12)).toBe("WAVE");

    await Effect.runPromise(service.cleanupCapturedAudio(audio));
  });

  it("exposes captured audio cleanup as part of the service boundary", async () => {
    const service = createMockAudioCaptureService();

    await Effect.runPromise(service.startRecording("session_1"));
    const audio = await Effect.runPromise(service.stopRecording("hotkey-release"));

    await expect(Effect.runPromise(service.cleanupCapturedAudio(audio))).resolves.toBeUndefined();
  });
});
