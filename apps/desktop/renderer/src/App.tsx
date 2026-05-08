import { useCallback, useEffect, useState } from "react";
import type { AppSettings, AppStateSnapshot } from "@molten-voice/shared";
import { getRendererApi } from "./api/renderer-api";
import { HistoryView } from "./features/history/HistoryView";
import { OverlayView } from "./features/overlay/OverlayView";
import { SetupFlow } from "./features/setup/SetupFlow";

export const App = () => {
  const [snapshot, setSnapshot] = useState<AppStateSnapshot | null>(null);
  const [historyQuery, setHistoryQuery] = useState("");

  const refreshSnapshot = useCallback(async () => {
    setSnapshot(await getRendererApi().getAppState());
  }, []);

  const searchHistory = useCallback(async (query: string) => {
    setHistoryQuery(query);
    const transcripts = await getRendererApi().listTranscripts(query);

    setSnapshot((current) => (current ? { ...current, transcripts } : current));
  }, []);

  const startTestDictation = useCallback(async () => {
    await getRendererApi().startTestDictation();
    await refreshSnapshot();
  }, [refreshSnapshot]);

  const stopTestDictation = useCallback(async () => {
    await getRendererApi().stopTestDictation();
    await refreshSnapshot();
  }, [refreshSnapshot]);

  const updateSettings = useCallback(async (settings: AppSettings) => {
    const nextSettings = await getRendererApi().updateSettings(settings);

    setSnapshot((current) =>
      current
        ? {
            ...current,
            setupComplete: Boolean(nextSettings.activeModelId),
            settings: nextSettings,
          }
        : current,
    );
  }, []);

  useEffect(() => {
    void refreshSnapshot();
  }, [refreshSnapshot]);

  return (
    <main className="grid min-h-screen grid-cols-[286px_minmax(0,1fr)_336px] overflow-hidden bg-background text-foreground max-[1040px]:grid-cols-[240px_minmax(0,1fr)] max-md:grid-cols-1 max-md:overflow-auto">
      <SetupFlow
        isRecording={snapshot?.overlayState === "recording"}
        settings={snapshot?.settings ?? null}
        onStartTestDictation={startTestDictation}
        onStopTestDictation={stopTestDictation}
        onSettingsChange={updateSettings}
      >
        <HistoryView
          query={historyQuery}
          transcripts={snapshot?.transcripts ?? []}
          onQueryChange={searchHistory}
        />
      </SetupFlow>
      <OverlayView state={snapshot?.overlayState ?? "hidden"} />
    </main>
  );
};
