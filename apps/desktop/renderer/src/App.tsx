import { useCallback, useEffect, useState } from "react";
import type { AppSettings, AppStateSnapshot } from "@molten-voice/shared";
import { getRendererApi } from "./api/renderer-api";
import { HistoryView } from "./features/history/HistoryView";
import { SetupFlow } from "./features/setup/SetupFlow";
import { cn } from "./lib/utils";

interface AppProps {
  readonly view?: "workbench" | "setup" | "history" | "settings";
}

export const App = ({ view = "workbench" }: AppProps) => {
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

  const installModel = useCallback(
    async (modelId: string) => {
      await runAction(async () => {
        await getRendererApi().installModel(modelId);
        await refreshSnapshot();
      });
    },
    [refreshSnapshot, runAction],
  );

  useEffect(() => {
    void refreshSnapshot();

    return getRendererApi().onAppStateChanged(setSnapshot);
  }, [refreshSnapshot]);

  const effectiveErrorMessage = errorMessage ?? snapshot?.errorMessage ?? null;
  const historyView = (
    <HistoryView
      query={historyQuery}
      transcripts={snapshot?.transcripts ?? []}
      variant={view === "history" ? "page" : "panel"}
      onClear={clearTranscripts}
      onDelete={deleteTranscript}
      onQueryChange={searchHistory}
    />
  );

  if (view === "history") {
    return (
      <main className="grid min-h-screen grid-cols-[286px_minmax(0,1fr)] overflow-hidden bg-background text-foreground max-md:grid-cols-1 max-md:overflow-auto">
        <SetupFlow
          errorMessage={effectiveErrorMessage}
          isRecording={snapshot?.overlayState === "recording"}
          modelInstallProgress={snapshot?.modelInstallProgress ?? null}
          settings={snapshot?.settings ?? null}
          onDismissError={() => setErrorMessage(null)}
          onStartTestDictation={startTestDictation}
          onStopTestDictation={stopTestDictation}
          onInstallModel={installModel}
          onSettingsChange={updateSettings}
        />
        {historyView}
      </main>
    );
  }

  return (
    <main
      className={cn(
        "grid min-h-screen overflow-hidden bg-background text-foreground max-md:grid-cols-1 max-md:overflow-auto",
        view === "workbench"
          ? "grid-cols-[286px_minmax(0,1fr)_336px] max-[1040px]:grid-cols-[240px_minmax(0,1fr)]"
          : "grid-cols-[286px_minmax(0,1fr)] max-[1040px]:grid-cols-[240px_minmax(0,1fr)]",
      )}
    >
      <SetupFlow
        errorMessage={effectiveErrorMessage}
        isRecording={snapshot?.overlayState === "recording"}
        modelInstallProgress={snapshot?.modelInstallProgress ?? null}
        settings={snapshot?.settings ?? null}
        onDismissError={() => setErrorMessage(null)}
        onStartTestDictation={startTestDictation}
        onStopTestDictation={stopTestDictation}
        onInstallModel={installModel}
        onSettingsChange={updateSettings}
      >
        {view === "workbench" ? historyView : null}
      </SetupFlow>
    </main>
  );
};
