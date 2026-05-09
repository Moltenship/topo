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

    return getRendererApi().onAppStateChanged(setSnapshot);
  }, [refreshSnapshot]);

  return (
    <main className="h-screen w-screen overflow-hidden bg-transparent">
      <OverlayView state={snapshot?.overlayState ?? "hidden"} variant="window" />
    </main>
  );
};
