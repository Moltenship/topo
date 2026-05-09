import { describe, expect, it, vi } from "vitest";
import {
  buildSendKeysPowerShellCommand,
  escapeSendKeysText,
  insertTextWithWindowsAutomation,
  toPowerShellSingleQuotedString,
} from "./windows-text-insertion";

describe("windows text insertion helpers", () => {
  it("escapes SendKeys control characters for typing mode", () => {
    expect(escapeSendKeysText("a+b^c%d~e(f)g{h}i[j]")).toBe(
      "a{+}b{^}c{%}d{~}e{(}f{)}g{{}h{}}i{[}j{]}",
    );
  });

  it("quotes PowerShell single-quoted strings", () => {
    expect(toPowerShellSingleQuotedString("it's ok")).toBe("'it''s ok'");
  });

  it("builds a paste command", () => {
    expect(buildSendKeysPowerShellCommand("^v")).toContain(
      "[System.Windows.Forms.SendKeys]::SendWait('^v')",
    );
  });

  it("writes text to clipboard, sends paste, and restores previous text clipboard", async () => {
    vi.useFakeTimers();
    const writes: string[] = [];
    const runCommand = vi.fn<() => Promise<void>>(() => Promise.resolve());
    const clipboard = {
      readText: () => "before",
      writeText: (text: string) => {
        writes.push(text);
      },
    };

    await insertTextWithWindowsAutomation({
      clipboard,
      mode: "paste",
      restoreDelayMs: 10,
      runCommand,
      text: "after",
    });

    expect(writes).toEqual(["after"]);
    expect(runCommand).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(10);
    expect(writes).toEqual(["after", "before"]);
    vi.useRealTimers();
  });
});
