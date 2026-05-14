import { describe, expect, it } from "vitest";
import { createHotkeyCoordinator } from "./hotkey-coordinator";

describe("createHotkeyCoordinator", () => {
  it("starts and stops toggle recording on repeated down events", () => {
    const coordinator = createHotkeyCoordinator();

    expect(coordinator.handle({ mode: "toggle-to-talk", phase: "down", timestampMs: 100 })).toBe(
      "start-recording",
    );
    expect(coordinator.handle({ mode: "toggle-to-talk", phase: "down", timestampMs: 200 })).toBe(
      "stop-recording",
    );
  });

  it("starts push-to-talk on down and stops on release", () => {
    const coordinator = createHotkeyCoordinator();

    expect(coordinator.handle({ mode: "push-to-talk", phase: "down", timestampMs: 100 })).toBe(
      "start-recording",
    );
    expect(coordinator.handle({ mode: "push-to-talk", phase: "up", timestampMs: 200 })).toBe(
      "stop-recording",
    );
  });

  it("debounces rapid press events but always allows push-to-talk release", () => {
    const coordinator = createHotkeyCoordinator({ debounceMs: 30 });

    expect(coordinator.handle({ mode: "push-to-talk", phase: "down", timestampMs: 100 })).toBe(
      "start-recording",
    );
    expect(coordinator.handle({ mode: "push-to-talk", phase: "down", timestampMs: 110 })).toBe(
      "ignore",
    );
    expect(coordinator.handle({ mode: "push-to-talk", phase: "up", timestampMs: 111 })).toBe(
      "stop-recording",
    );
  });

  it("ignores hotkey input while processing until processing finishes", () => {
    const coordinator = createHotkeyCoordinator();

    expect(coordinator.handle({ mode: "push-to-talk", phase: "down", timestampMs: 100 })).toBe(
      "start-recording",
    );
    expect(coordinator.handle({ mode: "push-to-talk", phase: "up", timestampMs: 200 })).toBe(
      "stop-recording",
    );
    expect(coordinator.handle({ mode: "push-to-talk", phase: "down", timestampMs: 300 })).toBe(
      "ignore",
    );

    coordinator.processingFinished();

    expect(coordinator.handle({ mode: "push-to-talk", phase: "down", timestampMs: 400 })).toBe(
      "start-recording",
    );
  });

  it("cancels recording and returns idle", () => {
    const coordinator = createHotkeyCoordinator();

    expect(coordinator.handle({ mode: "toggle-to-talk", phase: "down", timestampMs: 100 })).toBe(
      "start-recording",
    );
    expect(coordinator.cancel()).toBe("cancel-recording");
    expect(coordinator.handle({ mode: "toggle-to-talk", phase: "down", timestampMs: 200 })).toBe(
      "start-recording",
    );
  });
});
