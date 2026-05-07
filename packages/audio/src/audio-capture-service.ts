import type { LevelFrame, StopReason } from "@molten-voice/shared";

export interface CapturedAudio {
  readonly sessionId: string;
  readonly audioPath: string;
  readonly durationMs: number;
}

export type Unsubscribe = () => void;

export interface AudioCaptureService {
  readonly startRecording: (sessionId: string) => Promise<void>;
  readonly stopRecording: (reason: StopReason) => Promise<CapturedAudio>;
  readonly onLevelFrame: (listener: (frame: LevelFrame) => void) => Unsubscribe;
}

export const createMockAudioCaptureService = (): AudioCaptureService => {
  let activeSessionId: string | null = null;
  const listeners = new Set<(frame: LevelFrame) => void>();

  return {
    startRecording: async (sessionId) => {
      activeSessionId = sessionId;
      for (const listener of listeners) {
        listener({ sessionId, timestampMs: Date.now(), rms: 0.4, peak: 0.7 });
      }
    },
    stopRecording: async () => {
      if (activeSessionId === null) {
        throw new Error("No active recording session");
      }

      const sessionId = activeSessionId;
      activeSessionId = null;

      return {
        sessionId,
        audioPath: `mock://${sessionId}.wav`,
        durationMs: 1200,
      };
    },
    onLevelFrame: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};
