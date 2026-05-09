import { useCallback, useEffect, useState } from "react";
import type { AppStateSnapshot } from "@molten-voice/shared";
import { getRendererApi } from "./api/renderer-api";
import { OverlayView } from "./features/overlay/OverlayView";

export const OverlayApp = () => {
  const [snapshot, setSnapshot] = useState<AppStateSnapshot | null>(null);

  const refreshSnapshot = useCallback(async () => {
    setSnapshot(await getRendererApi().getAppState());
  }, []);

  const commitPreviewPosition = useCallback(async (point: { centerX: number; centerY: number }) => {
    await getRendererApi().commitOverlayPreviewPosition(point);
  }, []);

  useEffect(() => {
    void refreshSnapshot();

    return getRendererApi().onAppStateChanged(setSnapshot);
  }, [refreshSnapshot]);

  return (
    <main className="h-screen w-screen overflow-hidden bg-transparent">
      <OverlayView
        position={snapshot?.settings.overlayPosition ?? "bottom-center"}
        state={snapshot?.overlayState ?? "hidden"}
        variant="window"
        onCommitPreviewPosition={commitPreviewPosition}
      />
    </main>
  );
};
