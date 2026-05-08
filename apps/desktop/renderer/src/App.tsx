import { useCallback, useEffect, useState } from "react";
import type { AppSettings, AppStateSnapshot } from "@molten-voice/shared";
import { getRendererApi } from "./api/renderer-api";
import { HistoryView } from "./features/history/HistoryView";
import { SetupFlow } from "./features/setup/SetupFlow";

export const App = () => {
  const [snapshot, setSnapshot] = useState<AppStateSnapshot | null>(null);
  const [historyQuery, setHistoryQuery] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const runAction = useCallback(async (action: () => Promise<void>) => {
    setErrorMessage(null);

    try {
      await action();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unexpected local workflow error.");
    }
  }, []);

  const refreshSnapshot = useCallback(async () => {
    setSnapshot(await getRendererApi().getAppState());
  }, []);

  const searchHistory = useCallback(async (query: string) => {
    setHistoryQuery(query);
    const transcripts = await getRendererApi().listTranscripts(query);

    setSnapshot((current) => (current ? { ...current, transcripts } : current));
  }, []);

  const startTestDictation = useCallback(async () => {
    await runAction(async () => {
      await getRendererApi().startTestDictation();
      await refreshSnapshot();
    });
  }, [refreshSnapshot, runAction]);

  const stopTestDictation = useCallback(async () => {
    await runAction(async () => {
      await getRendererApi().stopTestDictation();
      await refreshSnapshot();
    });
  }, [refreshSnapshot, runAction]);

  const deleteTranscript = useCallback(
    async (id: string) => {
      await runAction(async () => {
        await getRendererApi().deleteTranscript(id);
        await searchHistory(historyQuery);
      });
    },
    [historyQuery, runAction, searchHistory],
  );

  const clearTranscripts = useCallback(async () => {
    await runAction(async () => {
      await getRendererApi().clearTranscripts();
      await searchHistory(historyQuery);
    });
  }, [historyQuery, runAction, searchHistory]);

  const updateSettings = useCallback(
    async (settings: AppSettings) => {
      await runAction(async () => {
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
      });
    },
    [runAction],
  );

  useEffect(() => {
    void refreshSnapshot();

    return getRendererApi().onAppStateChanged(setSnapshot);
  }, [refreshSnapshot]);

  return (
    <main className="grid min-h-screen grid-cols-[286px_minmax(0,1fr)_336px] overflow-hidden bg-background text-foreground max-[1040px]:grid-cols-[240px_minmax(0,1fr)] max-md:grid-cols-1 max-md:overflow-auto">
      <SetupFlow
        errorMessage={errorMessage}
        isRecording={snapshot?.overlayState === "recording"}
        settings={snapshot?.settings ?? null}
        onDismissError={() => setErrorMessage(null)}
        onStartTestDictation={startTestDictation}
        onStopTestDictation={stopTestDictation}
        onSettingsChange={updateSettings}
      >
        <HistoryView
          query={historyQuery}
          transcripts={snapshot?.transcripts ?? []}
          onClear={clearTranscripts}
          onDelete={deleteTranscript}
          onQueryChange={searchHistory}
        />
      </SetupFlow>
    </main>
  );
};
