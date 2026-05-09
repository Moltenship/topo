import { BarVisualizer, type AgentState } from "@/components/ui/bar-visualizer";
import { cn } from "@/lib/utils";
import type { OverlayState } from "@molten-voice/shared";

const visualizerState = {
  recording: "listening",
  processing: "thinking",
  inserted: "speaking",
  error: "thinking",
} satisfies Partial<Record<OverlayState, AgentState>>;

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
        "relative overflow-hidden rounded-full bg-[#1c1c1d] text-foreground",
        variant === "preview" &&
          "fixed bottom-4 left-1/2 -translate-x-1/2 shadow-[0_18px_48px_rgba(0,0,0,0.45)]",
        variant === "window" && "h-screen w-screen",
      )}
      aria-label="Recording overlay preview"
    >
      <span
        className={cn(
          "absolute left-5 top-1/2 z-10 size-2.5 -translate-y-1/2 rounded-full",
          state === "error" ? "bg-destructive" : "bg-[#ff4667]",
          state === "recording" && "shadow-[0_0_18px_rgba(255,70,103,0.55)]",
        )}
      />
      <BarVisualizer
        state={visualizerState[state] ?? "listening"}
        demo={true}
        barCount={36}
        minHeight={16}
        maxHeight={92}
        centerAlign={true}
        className={cn(
          "h-20 w-full gap-1 rounded-full bg-transparent py-3 pl-14 pr-6",
          state === "error" && "[&_[data-slot=bar-visualizer-bar]]:bg-muted-foreground/35",
        )}
      />
    </aside>
  );
};
