import { useCallback, useEffect, useState } from "react";
import type { AppStateSnapshot } from "@molten-voice/shared";
import { getRendererApi } from "./api/renderer-api";
import { OverlayView } from "./features/overlay/OverlayView";

export const OverlayApp = () => {
  const [snapshot, setSnapshot] = useState<AppStateSnapshot | null>(null);

  const refreshSnapshot = useCallback(async () => {
    setSnapshot(await getRendererApi().getAppState());
  }, []);

  useEffect(() => {
    void refreshSnapshot();

    const intervalId = window.setInterval(() => {
      void refreshSnapshot();
    }, 500);

    return () => window.clearInterval(intervalId);
  }, [refreshSnapshot]);

  return (
    <main className="min-h-screen bg-transparent">
      <OverlayView state={snapshot?.overlayState ?? "hidden"} variant="window" />
    </main>
  );
};
