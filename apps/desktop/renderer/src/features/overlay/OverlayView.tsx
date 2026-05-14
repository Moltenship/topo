import { BarVisualizer, type AgentState } from "@/components/ui/bar-visualizer";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import type { PointerEvent } from "react";
import type { OverlayPosition, OverlayState } from "@topo/shared";

const visualizerState = {
  preview: "listening",
  recording: "listening",
  processing: "thinking",
  inserted: "speaking",
  error: "thinking",
} satisfies Partial<Record<OverlayState, AgentState>>;

const overlayPillSize = {
  width: 496,
  height: 80,
} as const;

const getPreviewPositionClassName = (position: OverlayPosition): string => {
  switch (position) {
    case "top-center":
      return "left-1/2 top-6 -translate-x-1/2";
    case "bottom-left":
      return "bottom-6 left-6";
    case "bottom-right":
      return "bottom-6 right-6";
    case "center-left":
      return "left-6 top-1/2 -translate-y-1/2";
    case "center-right":
      return "right-6 top-1/2 -translate-y-1/2";
    case "bottom-center":
      return "bottom-6 left-1/2 -translate-x-1/2";
  }
};

interface OverlayViewProps {
  readonly state: OverlayState;
  readonly position?: OverlayPosition;
  readonly variant?: "preview" | "window";
  readonly onCommitPreviewPosition?: (point: {
    readonly centerX: number;
    readonly centerY: number;
  }) => void;
}

export const OverlayView = ({
  state,
  position = "bottom-center",
  variant = "preview",
  onCommitPreviewPosition,
}: OverlayViewProps) => {
  const [dragState, setDragState] = useState<{
    readonly pointerId: number;
    readonly offsetX: number;
    readonly offsetY: number;
    readonly left: number;
    readonly top: number;
  } | null>(null);
  const isWindowPreview = variant === "window" && state === "preview";

  useEffect(() => {
    setDragState(null);
  }, [position, state]);

  if (state === "hidden") {
    return null;
  }

  const startDrag = (event: PointerEvent<HTMLElement>) => {
    if (!isWindowPreview) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState({
      pointerId: event.pointerId,
      offsetX: event.clientX - bounds.left,
      offsetY: event.clientY - bounds.top,
      left: bounds.left,
      top: bounds.top,
    });
  };

  const moveDrag = (event: PointerEvent<HTMLElement>) => {
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const maxLeft = Math.max(0, window.innerWidth - overlayPillSize.width);
    const maxTop = Math.max(0, window.innerHeight - overlayPillSize.height);
    const left = Math.min(Math.max(event.clientX - dragState.offsetX, 0), maxLeft);
    const top = Math.min(Math.max(event.clientY - dragState.offsetY, 0), maxTop);

    setDragState({ ...dragState, left, top });
  };

  const finishDrag = (event: PointerEvent<HTMLElement>) => {
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    event.currentTarget.releasePointerCapture(event.pointerId);
    onCommitPreviewPosition?.({
      centerX: dragState.left + overlayPillSize.width / 2,
      centerY: dragState.top + overlayPillSize.height / 2,
    });
    setDragState(null);
  };

  const pill = (
    <aside
      style={
        dragState
          ? {
              left: dragState.left,
              top: dragState.top,
              width: overlayPillSize.width,
              height: overlayPillSize.height,
            }
          : undefined
      }
      className={cn(
        "relative overflow-hidden rounded-full bg-[#1c1c1d] text-foreground",
        variant === "preview" &&
          "fixed bottom-4 left-1/2 -translate-x-1/2 shadow-[0_18px_48px_rgba(0,0,0,0.45)]",
        variant === "window" && state !== "preview" && "h-screen w-screen",
        isWindowPreview &&
          "absolute h-20 w-[496px] cursor-grab touch-none shadow-[0_18px_48px_rgba(0,0,0,0.45)] active:cursor-grabbing",
        isWindowPreview && !dragState && getPreviewPositionClassName(position),
        dragState && "translate-x-0 translate-y-0",
      )}
      aria-label="Recording overlay preview"
      onPointerCancel={finishDrag}
      onPointerDown={startDrag}
      onPointerMove={moveDrag}
      onPointerUp={finishDrag}
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

  if (isWindowPreview) {
    return <div className="h-screen w-screen bg-transparent">{pill}</div>;
  }

  return pill;
};
