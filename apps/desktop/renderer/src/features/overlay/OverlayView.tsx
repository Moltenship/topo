import type { OverlayState } from "@molten-voice/shared";
import { cn } from "@/lib/utils";

const bars = [18, 28, 42, 34, 50, 32, 24, 38, 20];

interface OverlayViewProps {
  readonly state: OverlayState;
  readonly variant?: "preview" | "window";
}

export const OverlayView = ({ state, variant = "preview" }: OverlayViewProps) => {
  if (state === "hidden") {
    return null;
  }

  return (
    <aside
      className={cn(
        "grid grid-cols-[10px_auto_auto] items-center gap-3.5 rounded-full border bg-card/90 px-4 py-2.5 text-foreground shadow-sm backdrop-blur",
        variant === "preview" && "fixed bottom-4 left-1/2 -translate-x-1/2",
        variant === "window" && "h-screen w-screen border-0 bg-card/95",
      )}
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
