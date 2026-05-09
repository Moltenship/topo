import { describe, expect, it } from "vitest";
import { getNearestOverlayPosition, getOverlayWindowBounds } from "./overlay-position";

describe("getOverlayWindowBounds", () => {
  const workArea = { x: 0, y: 0, width: 1920, height: 1080 };
  const windowSize = { width: 496, height: 80 };

  it("positions the overlay at bottom center by default", () => {
    expect(getOverlayWindowBounds({ position: "bottom-center", workArea, windowSize })).toEqual({
      x: 712,
      y: 976,
      width: 496,
      height: 80,
    });
  });

  it("positions the overlay at top center", () => {
    expect(getOverlayWindowBounds({ position: "top-center", workArea, windowSize })).toEqual({
      x: 712,
      y: 24,
      width: 496,
      height: 80,
    });
  });

  it("positions the overlay on the bottom right", () => {
    expect(getOverlayWindowBounds({ position: "bottom-right", workArea, windowSize })).toEqual({
      x: 1400,
      y: 976,
      width: 496,
      height: 80,
    });
  });

  it("maps a dragged preview point to the nearest overlay position", () => {
    expect(
      getNearestOverlayPosition({
        center: { x: 1840, y: 1020 },
        workArea,
      }),
    ).toBe("bottom-right");
    expect(
      getNearestOverlayPosition({
        center: { x: 960, y: 80 },
        workArea,
      }),
    ).toBe("top-center");
  });
});
