import { describe, expect, it } from "vitest";
import { formatHotkey, normalizeHotkeyFromKeys } from "./hotkey";

describe("hotkey normalization", () => {
  it("keeps a single non-modifier key as the hotkey", () => {
    expect(normalizeHotkeyFromKeys(["CapsLock"])).toBe("CapsLock");
  });

  it("orders modifiers before the trigger key", () => {
    expect(normalizeHotkeyFromKeys(["KeyK", "Shift", "Control"])).toBe("Ctrl+Shift+K");
  });

  it("renders normalized hotkeys for settings", () => {
    expect(formatHotkey("Ctrl+Shift+Space")).toBe("Ctrl + Shift + Space");
  });
});
