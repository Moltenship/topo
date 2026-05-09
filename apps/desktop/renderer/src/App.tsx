import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_APP_SETTINGS,
  type AppSettings,
  type AppStateSnapshot,
} from "@molten-voice/shared";
import { AppShell } from "./components/AppShell";
import { AppTitleBar } from "./components/AppTitleBar";
import { getRendererApi } from "./api/renderer-api";
import { HistoryView } from "./features/history/HistoryView";
import { SettingsPage } from "./features/settings/SettingsPage";
import {
  startBrowserAudioRecorder,
  type BrowserAudioRecorder,
} from "./features/dictation/browser-audio-recorder";

interface AppProps {
  readonly view?: "workbench" | "setup" | "history";
}

const settingsEqual = (left: AppSettings | null, right: AppSettings): boolean =>
  left !== null && JSON.stringify(left) === JSON.stringify(right);

const AppChrome = ({
  canRestoreDefaults,
  children,
  onRestoreDefaults,
}: {
  readonly canRestoreDefaults: boolean;
  readonly children: React.ReactNode;
  readonly onRestoreDefaults: () => void;
}) => (
  <div className="grid h-screen grid-rows-[52px_minmax(0,1fr)] overflow-hidden bg-background text-foreground">
    <AppTitleBar canRestoreDefaults={canRestoreDefaults} onRestoreDefaults={onRestoreDefaults} />
    {children}
  </div>
);

export const App = ({ view = "workbench" }: AppProps) => {
  const [snapshot, setSnapshot] = useState<AppStateSnapshot | null>(null);
  const [historyQuery, setHistoryQuery] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const testAudioRecorderRef = useRef<BrowserAudioRecorder | null>(null);

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
      const recorder = await startBrowserAudioRecorder(
        snapshot?.settings.microphoneDeviceId ?? null,
      );
      try {
        await getRendererApi().startTestDictation();
      } catch (error) {
        await recorder.stop();
        throw error;
      }
      testAudioRecorderRef.current = recorder;
      await refreshSnapshot();
    });
  }, [refreshSnapshot, runAction, snapshot?.settings.microphoneDeviceId]);

  const stopTestDictation = useCallback(async () => {
    await runAction(async () => {
      const recorder = testAudioRecorderRef.current;

      if (!recorder) {
        throw new Error("No active browser recording session.");
      }

      testAudioRecorderRef.current = null;
      const audio = await recorder.stop();
      await getRendererApi().stopTestDictation(audio);
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

  const copyTranscript = useCallback(
    async (id: string) => {
      await runAction(async () => {
        await getRendererApi().copyTranscript(id);
      });
    },
    [runAction],
  );

  const reinsertTranscript = useCallback(
    async (id: string) => {
      await runAction(async () => {
        await getRendererApi().reinsertTranscript(id);
      });
    },
    [runAction],
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

  const cancelModelInstall = useCallback(
    async (modelId: string) => {
      await runAction(async () => {
        await getRendererApi().cancelModelInstall(modelId);
        await refreshSnapshot();
      });
    },
    [refreshSnapshot, runAction],
  );

  const showOverlayPreview = useCallback(async () => {
    await runAction(async () => {
      await getRendererApi().showOverlayPreview();
      await refreshSnapshot();
    });
  }, [refreshSnapshot, runAction]);

  const restoreDefaultSettings = useCallback(async () => {
    await updateSettings(DEFAULT_APP_SETTINGS);
  }, [updateSettings]);

  useEffect(() => {
    void refreshSnapshot();

    return getRendererApi().onAppStateChanged(setSnapshot);
  }, [refreshSnapshot]);

  useEffect(
    () =>
      getRendererApi().onGlobalHotkeyEvent((event) => {
        if (event.phase === "down" && !testAudioRecorderRef.current) {
          void startTestDictation();
          return;
        }

        if (event.phase === "up" && testAudioRecorderRef.current) {
          void stopTestDictation();
        }
      }),
    [startTestDictation, stopTestDictation],
  );

  const effectiveErrorMessage = errorMessage ?? snapshot?.errorMessage ?? null;
  const canRestoreDefaults = !settingsEqual(snapshot?.settings ?? null, DEFAULT_APP_SETTINGS);
  const historyView = (
    <HistoryView
      query={historyQuery}
      transcripts={snapshot?.transcripts ?? []}
      variant={view === "history" ? "page" : "panel"}
      onClear={clearTranscripts}
      onCopy={copyTranscript}
      onDelete={deleteTranscript}
      onQueryChange={searchHistory}
      onReinsert={reinsertTranscript}
    />
  );

  if (view === "history") {
    return (
      <AppChrome canRestoreDefaults={canRestoreDefaults} onRestoreDefaults={restoreDefaultSettings}>
        <AppShell>{historyView}</AppShell>
      </AppChrome>
    );
  }

  return (
    <AppChrome canRestoreDefaults={canRestoreDefaults} onRestoreDefaults={restoreDefaultSettings}>
      <AppShell>
        <SettingsPage
          errorMessage={effectiveErrorMessage}
          installedModels={snapshot?.installedModels ?? []}
          isRecording={snapshot?.overlayState === "recording"}
          modelInstallProgress={snapshot?.modelInstallProgress ?? null}
          modelReadiness={snapshot?.modelReadiness ?? []}
          settings={snapshot?.settings ?? null}
          transcriptCount={snapshot?.transcripts.length ?? 0}
          onCancelModelInstall={cancelModelInstall}
          onClearTranscripts={clearTranscripts}
          onDismissError={() => setErrorMessage(null)}
          onInstallModel={installModel}
          onSettingsChange={updateSettings}
          onShowOverlayPreview={showOverlayPreview}
          onStartTestDictation={startTestDictation}
          onStopTestDictation={stopTestDictation}
        />
      </AppShell>
    </AppChrome>
  );
};
