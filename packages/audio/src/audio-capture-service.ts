import { Effect } from "effect";
import type { LevelFrame, StopReason } from "@molten-voice/shared";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface CapturedAudio {
  readonly sessionId: string;
  readonly audioPath: string;
  readonly durationMs: number;
}

export type Unsubscribe = () => void;

export interface AudioCaptureService {
  readonly startRecording: (sessionId: string) => Effect.Effect<void>;
  readonly stopRecording: (reason: StopReason) => Effect.Effect<CapturedAudio, Error>;
  readonly cleanupCapturedAudio: (audio: CapturedAudio) => Effect.Effect<void, Error>;
  readonly onLevelFrame: (listener: (frame: LevelFrame) => void) => Unsubscribe;
}

export const createMockAudioCaptureService = (): AudioCaptureService => {
  let activeSessionId: string | null = null;
  const listeners = new Set<(frame: LevelFrame) => void>();

  return {
    startRecording: (sessionId) =>
      Effect.sync(() => {
        activeSessionId = sessionId;
        for (const listener of listeners) {
          listener({ sessionId, timestampMs: Date.now(), rms: 0.4, peak: 0.7 });
        }
      }),
    stopRecording: () =>
      Effect.tryPromise({
        try: async () => {
          if (activeSessionId === null) {
            throw new Error("No active recording session");
          }

          const sessionId = activeSessionId;
          activeSessionId = null;
          const durationMs = 1200;
          const audioPath = await writeSilentWav(sessionId, durationMs);

          return {
            sessionId,
            audioPath,
            durationMs,
          };
        },
        catch: (error) => (error instanceof Error ? error : new Error(String(error))),
      }),
    cleanupCapturedAudio: (audio) =>
      Effect.tryPromise({
        try: () => rm(audio.audioPath, { force: true }),
        catch: (error) => (error instanceof Error ? error : new Error(String(error))),
      }),
    onLevelFrame: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};

const writeSilentWav = async (sessionId: string, durationMs: number): Promise<string> => {
  const directory = join(tmpdir(), "molten-voice", "mock-captures");
  await mkdir(directory, { recursive: true });

  const audioPath = join(directory, `${sessionId}.wav`);
  await writeFile(audioPath, createSilentWav(durationMs));

  return audioPath;
};

const createSilentWav = (durationMs: number): Buffer => {
  const sampleRate = 16_000;
  const channelCount = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const sampleCount = Math.max(1, Math.round((sampleRate * durationMs) / 1000));
  const dataSize = sampleCount * channelCount * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channelCount, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channelCount * bytesPerSample, 28);
  buffer.writeUInt16LE(channelCount * bytesPerSample, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataSize, 40);

  return buffer;
};
