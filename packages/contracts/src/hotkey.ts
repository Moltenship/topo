const modifierOrder = ["Ctrl", "Alt", "Shift", "Meta"] as const;

const keyAliases = new Map<string, string>([
  ["Control", "Ctrl"],
  ["ControlLeft", "Ctrl"],
  ["ControlRight", "Ctrl"],
  ["AltLeft", "Alt"],
  ["AltRight", "Alt"],
  ["ShiftLeft", "Shift"],
  ["ShiftRight", "Shift"],
  ["MetaLeft", "Meta"],
  ["MetaRight", "Meta"],
  ["OSLeft", "Meta"],
  ["OSRight", "Meta"],
  [" ", "Space"],
  ["IntlBackslash", "\\"],
  ["Backslash", "\\"],
]);

const normalizeKey = (key: string): string => {
  const aliased = keyAliases.get(key);

  if (aliased) {
    return aliased;
  }

  if (/^Key[A-Z]$/.test(key)) {
    return key.slice(3);
  }

  if (/^Digit[0-9]$/.test(key)) {
    return key.slice(5);
  }

  return key.length === 1 ? key.toUpperCase() : key;
};

export const normalizeHotkeyFromKeys = (keys: readonly string[]): string => {
  const normalizedKeys = [...new Set(keys.map(normalizeKey))];
  const modifiers = modifierOrder.filter((modifier) => normalizedKeys.includes(modifier));
  const triggerKey = normalizedKeys.find((key) => !modifierOrder.includes(key as never));

  return [...modifiers, triggerKey].filter((key): key is string => Boolean(key)).join("+");
};

export const formatHotkey = (hotkey: string): string => hotkey.split("+").join(" + ");

export type NativeHotkeyPhase = "down" | "up";

export interface NativeHotkeyEvent {
  readonly hotkey: string;
  readonly phase: NativeHotkeyPhase;
  readonly timestampMs: number;
}
