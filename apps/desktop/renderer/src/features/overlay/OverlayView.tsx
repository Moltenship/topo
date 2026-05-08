import type { OverlayState } from "@molten-voice/shared";

const bars = [18, 28, 42, 34, 50, 32, 24, 38, 20];

interface OverlayViewProps {
  readonly state: OverlayState;
}

export const OverlayView = ({ state }: OverlayViewProps) => {
  if (state === "hidden") {
    return null;
  }

  return (
    <aside
      className="fixed bottom-4 left-1/2 grid -translate-x-1/2 grid-cols-[10px_auto_auto] items-center gap-3.5 rounded-full border bg-card/90 px-4 py-2.5 text-foreground shadow-sm backdrop-blur"
      aria-label="Recording overlay preview"
    >
      <span className="size-2.5 rounded-full bg-destructive" />
      <div className="flex h-11 items-center gap-1" aria-hidden="true">
        {bars.map((height, index) => (
          <span
            className="w-1 rounded-full bg-primary"
            key={`${height}-${index}`}
            style={{ height }}
          />
        ))}
      </div>
      <strong className="text-sm">{state === "recording" ? "Recording" : "Ready"}</strong>
    </aside>
  );
};
