import type { NativeHotkeyPhase, RecordingMode } from "@topo/shared";

export type HotkeyCoordinatorStage = "idle" | "recording" | "processing";
export type HotkeyCoordinatorAction =
  | "start-recording"
  | "stop-recording"
  | "cancel-recording"
  | "ignore";

export interface HotkeyCoordinatorInput {
  readonly mode: RecordingMode;
  readonly phase: NativeHotkeyPhase;
  readonly timestampMs: number;
}

export interface HotkeyCoordinator {
  readonly getStage: () => HotkeyCoordinatorStage;
  readonly handle: (input: HotkeyCoordinatorInput) => HotkeyCoordinatorAction;
  readonly cancel: () => HotkeyCoordinatorAction;
  readonly processingFinished: () => void;
}

export interface HotkeyCoordinatorOptions {
  readonly debounceMs?: number;
}

const isPushMode = (mode: RecordingMode): boolean =>
  mode === "push-to-talk" || mode === "push-to-talk-with-silence-timeout";

export const createHotkeyCoordinator = ({
  debounceMs = 30,
}: HotkeyCoordinatorOptions = {}): HotkeyCoordinator => {
  let stage: HotkeyCoordinatorStage = "idle";
  let lastPressAt: number | null = null;

  const isDebouncedPress = (input: HotkeyCoordinatorInput): boolean => {
    if (input.phase !== "down") {
      return false;
    }

    if (lastPressAt !== null && input.timestampMs - lastPressAt < debounceMs) {
      lastPressAt = input.timestampMs;
      return true;
    }

    lastPressAt = input.timestampMs;
    return false;
  };

  return {
    getStage: () => stage,
    handle: (input) => {
      if (isDebouncedPress(input)) {
        return "ignore";
      }

      if (stage === "processing") {
        return "ignore";
      }

      if (isPushMode(input.mode)) {
        if (stage === "idle" && input.phase === "down") {
          stage = "recording";
          return "start-recording";
        }

        if (stage === "recording" && input.phase === "up") {
          stage = "processing";
          return "stop-recording";
        }

        return "ignore";
      }

      if (input.phase !== "down") {
        return "ignore";
      }

      if (stage === "idle") {
        stage = "recording";
        return "start-recording";
      }

      stage = "processing";
      return "stop-recording";
    },
    cancel: () => {
      if (stage === "processing") {
        return "ignore";
      }

      if (stage === "recording") {
        stage = "idle";
        return "cancel-recording";
      }

      stage = "idle";
      return "ignore";
    },
    processingFinished: () => {
      stage = "idle";
    },
  };
};
