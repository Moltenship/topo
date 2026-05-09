import type { InsertionMode } from "@molten-voice/shared";

export interface TextClipboard {
  readonly readText: () => string;
  readonly writeText: (text: string) => void;
}

export interface WindowsTextInsertionInput {
  readonly clipboard: TextClipboard;
  readonly mode: InsertionMode;
  readonly restoreDelayMs?: number;
  readonly runCommand: (command: string) => Promise<void>;
  readonly text: string;
}

const sendKeysSpecialCharacters = new Set(["+", "^", "%", "~", "(", ")", "{", "}", "[", "]"]);

export const escapeSendKeysText = (text: string): string =>
  [...text]
    .map((character) => (sendKeysSpecialCharacters.has(character) ? `{${character}}` : character))
    .join("");

export const toPowerShellSingleQuotedString = (value: string): string =>
  `'${value.replace(/'/g, "''")}'`;

export const buildSendKeysPowerShellCommand = (keys: string): string =>
  [
    "Add-Type -AssemblyName System.Windows.Forms",
    `[System.Windows.Forms.SendKeys]::SendWait(${toPowerShellSingleQuotedString(keys)})`,
  ].join("; ");

export const insertTextWithWindowsAutomation = async ({
  clipboard,
  mode,
  restoreDelayMs = 250,
  runCommand,
  text,
}: WindowsTextInsertionInput): Promise<void> => {
  if (mode === "typing") {
    await runCommand(buildSendKeysPowerShellCommand(escapeSendKeysText(text)));
    return;
  }

  const previousText = clipboard.readText();
  clipboard.writeText(text);

  try {
    await runCommand(buildSendKeysPowerShellCommand("^v"));
  } catch (error) {
    if (mode !== "hybrid") {
      throw error;
    }

    await runCommand(buildSendKeysPowerShellCommand(escapeSendKeysText(text)));
  } finally {
    setTimeout(() => clipboard.writeText(previousText), restoreDelayMs);
  }
};
