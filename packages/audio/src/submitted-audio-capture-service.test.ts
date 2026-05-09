import { Effect } from "effect";
import { readFile, stat } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { createSubmittedAudioCaptureService } from "./audio-capture-service";

describe("createSubmittedAudioCaptureService", () => {
  it("stores submitted wav bytes as captured audio for the active session", async () => {
    const service = createSubmittedAudioCaptureService();
    const wavBytes = new Uint8Array(Buffer.alloc(45, 1));

    await Effect.runPromise(service.startRecording("session_1"));
    await Effect.runPromise(service.submitCapturedAudio({ durationMs: 2060, wavBytes }));
    const audio = await Effect.runPromise(service.stopRecording("hotkey-release"));

    expect(audio.sessionId).toBe("session_1");
    expect(audio.durationMs).toBe(2060);

    const audioStat = await stat(audio.audioPath);
    expect(audioStat.isFile()).toBe(true);
    expect(await readFile(audio.audioPath)).toEqual(Buffer.from(wavBytes));

    await Effect.runPromise(service.cleanupCapturedAudio(audio));
  });

  it("rejects submitted audio without sample data before creating a capture file", async () => {
    const service = createSubmittedAudioCaptureService();

    await Effect.runPromise(service.startRecording("session_1"));
    await Effect.runPromise(
      service.submitCapturedAudio({ durationMs: 0, wavBytes: new Uint8Array(Buffer.alloc(44)) }),
    );

    await expect(Effect.runPromise(service.stopRecording("hotkey-release"))).rejects.toThrow(
      "Recording is too short",
    );
  });
});
