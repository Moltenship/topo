const windowControlsOverlayClassName = "wco";

interface WindowControlsOverlayLike {
  readonly visible: boolean;
  addEventListener(type: "geometrychange", listener: EventListener): void;
  removeEventListener(type: "geometrychange", listener: EventListener): void;
}

interface NavigatorWithWindowControlsOverlay extends Navigator {
  readonly windowControlsOverlay?: WindowControlsOverlayLike;
}

const getWindowControlsOverlay = (): WindowControlsOverlayLike | null => {
  if (typeof navigator === "undefined") {
    return null;
  }

  return (navigator as NavigatorWithWindowControlsOverlay).windowControlsOverlay ?? null;
};

export const syncDocumentWindowControlsOverlayClass = (): (() => void) => {
  if (typeof document === "undefined") {
    return () => {};
  }

  const overlay = getWindowControlsOverlay();
  const update = () => {
    document.documentElement.classList.toggle(
      windowControlsOverlayClassName,
      overlay !== null && overlay.visible,
    );
  };

  update();
  if (!overlay) {
    return () => {};
  }

  overlay.addEventListener("geometrychange", update);
  return () => {
    overlay.removeEventListener("geometrychange", update);
  };
};
