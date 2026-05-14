import type { OverlayPosition } from "@topo/shared";

interface Rectangle {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface WindowSize {
  readonly width: number;
  readonly height: number;
}

export const OVERLAY_WINDOW_SIZE = {
  width: 496,
  height: 80,
} as const;

const margin = 24;

const overlayPositions = [
  "bottom-center",
  "top-center",
  "bottom-left",
  "bottom-right",
  "center-left",
  "center-right",
] as const satisfies readonly OverlayPosition[];

const getRectangleCenter = (rectangle: Rectangle) => ({
  x: rectangle.x + rectangle.width / 2,
  y: rectangle.y + rectangle.height / 2,
});

export const getOverlayWindowBounds = ({
  position,
  windowSize,
  workArea,
}: {
  readonly position: OverlayPosition;
  readonly windowSize: WindowSize;
  readonly workArea: Rectangle;
}): Rectangle => {
  const centerX = workArea.x + Math.round((workArea.width - windowSize.width) / 2);
  const centerY = workArea.y + Math.round((workArea.height - windowSize.height) / 2);
  const left = workArea.x + margin;
  const right = workArea.x + workArea.width - windowSize.width - margin;
  const top = workArea.y + margin;
  const bottom = workArea.y + workArea.height - windowSize.height - margin;

  switch (position) {
    case "top-center":
      return { ...windowSize, x: centerX, y: top };
    case "bottom-left":
      return { ...windowSize, x: left, y: bottom };
    case "bottom-right":
      return { ...windowSize, x: right, y: bottom };
    case "center-left":
      return { ...windowSize, x: left, y: centerY };
    case "center-right":
      return { ...windowSize, x: right, y: centerY };
    case "bottom-center":
      return { ...windowSize, x: centerX, y: bottom };
  }
};

export const getNearestOverlayPosition = ({
  center,
  workArea,
}: {
  readonly center: { readonly x: number; readonly y: number };
  readonly workArea: Rectangle;
}): OverlayPosition => {
  let nearestPosition: OverlayPosition = "bottom-center";
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const position of overlayPositions) {
    const candidateCenter = getRectangleCenter(
      getOverlayWindowBounds({
        position,
        workArea,
        windowSize: OVERLAY_WINDOW_SIZE,
      }),
    );
    const distance =
      Math.pow(candidateCenter.x - center.x, 2) + Math.pow(candidateCenter.y - center.y, 2);

    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestPosition = position;
    }
  }

  return nearestPosition;
};
