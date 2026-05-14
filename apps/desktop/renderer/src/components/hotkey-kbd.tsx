import { Kbd, KbdGroup } from "@/components/ui/kbd";

interface HotkeyKbdProps {
  readonly hotkey: string;
}

const keyLabel = (key: string): string => {
  if (/^Key[A-Z]$/.test(key)) {
    return key.slice(3);
  }

  return key;
};

function HotkeyKbd({ hotkey }: HotkeyKbdProps) {
  const keys = hotkey
    .split("+")
    .map((key) => key.trim())
    .filter(Boolean);

  return (
    <KbdGroup aria-label={keys.join(" plus ")}>
      {keys.map((key) => (
        <Kbd key={key}>{keyLabel(key)}</Kbd>
      ))}
    </KbdGroup>
  );
}

export { HotkeyKbd };
