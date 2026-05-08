import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { createMockNativeBridgeService } from "./native-bridge-service";

describe("createMockNativeBridgeService", () => {
  it("registers a hold hotkey listener and unsubscribes cleanly", async () => {
    const service = createMockNativeBridgeService({ now: () => 42 });
    const events: unknown[] = [];

    const unsubscribe = await Effect.runPromise(
      service.registerHotkey("CapsLock", (event) => events.push(event)),
    );

    await Effect.runPromise(service.emitHotkeyDown("CapsLock"));
    await Effect.runPromise(service.emitHotkeyUp("CapsLock"));
    unsubscribe();
    await Effect.runPromise(service.emitHotkeyDown("CapsLock"));

    expect(events).toEqual([
      { hotkey: "CapsLock", phase: "down", timestampMs: 42 },
      { hotkey: "CapsLock", phase: "up", timestampMs: 42 },
    ]);
  });

  it("records text insertion requests with the active application", async () => {
    const service = createMockNativeBridgeService({
      activeApplication: { appName: "Notes", windowTitle: "Daily log" },
    });

    const activeApplication = await Effect.runPromise(service.getActiveApplication());
    const insertion = await Effect.runPromise(
      service.insertText({ text: "hello world", mode: "paste" }),
    );

    expect(activeApplication).toEqual({ appName: "Notes", windowTitle: "Daily log" });
    expect(insertion).toEqual({ inserted: true, targetAppName: "Notes" });
    expect(service.insertedTexts).toEqual([{ text: "hello world", mode: "paste" }]);
  });
});
