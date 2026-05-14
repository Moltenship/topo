import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  DEFAULT_APP_SETTINGS,
  normalizeHotkeyFromKeys,
  type AppSettings,
  type InstallBundleProgress,
  type InstalledModelRecord,
  type ModelInstallProgress,
  type ModelReadinessRecord,
} from "@topo/shared";
import { getBundledModelCatalog } from "@topo/model-catalog";
import { HotkeyKbd } from "@/components/hotkey-kbd";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ModelCard } from "@/features/models/model-card";
import {
  SettingResetButton,
  SettingsRow,
  SettingsSection,
  SettingsSelect,
  SettingsSwitch,
} from "@/components/settings-layout";

interface SettingsPageProps {
  readonly errorMessage: string | null;
  readonly installedModels: readonly InstalledModelRecord[];
  readonly isRecording: boolean;
  readonly bundleInstallProgress: InstallBundleProgress | null;
  readonly modelInstallProgress: ModelInstallProgress | null;
  readonly modelReadiness: readonly ModelReadinessRecord[];
  readonly settings: AppSettings | null;
  readonly transcriptCount: number;
  readonly onCancelModelInstall: (modelId: string) => void;
  readonly onClearTranscripts: () => void;
  readonly onDismissError: () => void;
  readonly onInstallModel: (modelId: string) => void;
  readonly onRefreshModelReadiness: () => void;
  readonly onSettingsChange: (settings: AppSettings) => void;
  readonly onShowOverlayPreview: () => void;
  readonly onStartTestDictation: () => void;
  readonly onStopTestDictation: () => void;
}

const overlayPositionOptions = [
  { label: "Bottom center", value: "bottom-center" },
  { label: "Top center", value: "top-center" },
  { label: "Bottom left", value: "bottom-left" },
  { label: "Bottom right", value: "bottom-right" },
  { label: "Center left", value: "center-left" },
  { label: "Center right", value: "center-right" },
] as const;

const recordingModeOptions = [
  { label: "Press once", value: "toggle-to-talk" },
  { label: "Hold while speaking", value: "push-to-talk" },
  { label: "Hold, stop on silence", value: "push-to-talk-with-silence-timeout" },
] satisfies readonly { readonly label: string; readonly value: AppSettings["recordingMode"] }[];

const recordingModeDescriptions: Record<AppSettings["recordingMode"], string> = {
  "toggle-to-talk": "Press once to start recording; press again to stop and transcribe.",
  "push-to-talk": "Hold the hotkey while speaking; release to stop and transcribe.",
  "push-to-talk-with-silence-timeout":
    "Hold the hotkey while speaking; release or a silence timeout can finish the recording.",
};

const postProcessingModeLabels: Record<AppSettings["postProcessingMode"], string> = {
  raw: "Raw transcript",
  lightweight: "Lightweight cleanup",
  "apple-intelligence": "Apple Intelligence",
  api: "API provider",
};

interface MicrophoneDeviceOption {
  readonly label: string;
  readonly value: string | null;
}

const getTestDictationDescription = (
  activeReadiness: ModelReadinessRecord | undefined,
  activeModelId: string | null | undefined,
): string => {
  if (!activeModelId) {
    return "Choose a ready local model before starting a settings test recording.";
  }

  if (activeReadiness?.status === "ready") {
    return "Start a local recording session from settings to verify microphone and insertion flow.";
  }

  if (activeReadiness?.status === "runtime-missing") {
    return "The active model is installed, but the whisper.cpp runtime binary is missing.";
  }

  if (activeReadiness?.status === "runtime-failed") {
    return "The active model is installed, but the whisper.cpp runtime probe failed.";
  }

  return "The active model must be installed, verified, and runtime-ready before test dictation.";
};

export const SettingsPage = ({
  errorMessage,
  installedModels,
  isRecording,
  bundleInstallProgress,
  modelInstallProgress,
  modelReadiness,
  settings,
  transcriptCount,
  onCancelModelInstall,
  onClearTranscripts,
  onDismissError,
  onInstallModel,
  onRefreshModelReadiness,
  onSettingsChange,
  onShowOverlayPreview,
  onStartTestDictation,
  onStopTestDictation,
}: SettingsPageProps) => {
  const modelCatalog = [...getBundledModelCatalog({ includeDev: import.meta.env.DEV })].sort(
    (left, right) => {
      const leftActive = left.id === settings?.activeModelId ? 1 : 0;
      const rightActive = right.id === settings?.activeModelId ? 1 : 0;
      const leftInstalled = installedModels.some((model) => model.modelId === left.id) ? 1 : 0;
      const rightInstalled = installedModels.some((model) => model.modelId === right.id) ? 1 : 0;
      const leftRecommended = left.badges.includes("recommended") ? 1 : 0;
      const rightRecommended = right.badges.includes("recommended") ? 1 : 0;

      return (
        rightRecommended - leftRecommended ||
        rightActive - leftActive ||
        rightInstalled - leftInstalled ||
        left.downloadSizeBytes - right.downloadSizeBytes
      );
    },
  );
  const [expandedModelId, setExpandedModelId] = useState<string | null>(null);
  const [recordingHotkey, setRecordingHotkey] = useState(false);
  const [pressedHotkeyKeys, setPressedHotkeyKeys] = useState<readonly string[]>([]);
  const [microphoneDevices, setMicrophoneDevices] = useState<readonly MediaDeviceInfo[]>([]);
  const activeModelReadiness = modelReadiness.find(
    (readiness) => readiness.modelId === settings?.activeModelId,
  );
  const canStartTestDictation = activeModelReadiness?.status === "ready";
  const microphoneOptions = useMemo<readonly MicrophoneDeviceOption[]>(() => {
    const deviceOptions = microphoneDevices
      .filter((device) => device.kind === "audioinput")
      .map((device, index) => ({
        label: device.label || `Microphone ${index + 1}`,
        value: device.deviceId,
      }));

    return [{ label: "System default", value: null }, ...deviceOptions];
  }, [microphoneDevices]);

  const updateSettings = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    if (settings) {
      onSettingsChange({ ...settings, [key]: value });
    }
  };
  const resetSetting = <K extends keyof AppSettings>(key: K) => {
    updateSettings(key, DEFAULT_APP_SETTINGS[key]);
  };
  const getResetAction = <K extends keyof AppSettings>(key: K, label: string) =>
    settings && settings[key] !== DEFAULT_APP_SETTINGS[key] ? (
      <SettingResetButton label={label} onClick={() => resetSetting(key)} />
    ) : null;

  useEffect(() => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      return;
    }

    let disposed = false;

    const refreshMicrophones = async () => {
      const devices = await navigator.mediaDevices.enumerateDevices();
      if (!disposed) {
        setMicrophoneDevices(devices.filter((device) => device.kind === "audioinput"));
      }
    };

    void refreshMicrophones();
    navigator.mediaDevices.addEventListener?.("devicechange", refreshMicrophones);

    return () => {
      disposed = true;
      navigator.mediaDevices.removeEventListener?.("devicechange", refreshMicrophones);
    };
  }, []);

  useEffect(() => {
    if (!recordingHotkey) {
      setPressedHotkeyKeys([]);
      return;
    }

    const pressedKeys = new Set<string>();

    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      pressedKeys.add(event.code || event.key);
      setPressedHotkeyKeys([...pressedKeys]);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();

      const hotkey = normalizeHotkeyFromKeys([...pressedKeys]);

      if (hotkey && settings) {
        updateSettings("hotkey", hotkey);
      }

      setRecordingHotkey(false);
    };
    const onBlur = () => {
      setRecordingHotkey(false);
    };

    window.addEventListener("keydown", onKeyDown, { capture: true });
    window.addEventListener("keyup", onKeyUp, { capture: true });
    window.addEventListener("blur", onBlur);

    return () => {
      window.removeEventListener("keydown", onKeyDown, { capture: true });
      window.removeEventListener("keyup", onKeyUp, { capture: true });
      window.removeEventListener("blur", onBlur);
    };
  }, [recordingHotkey, settings]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      {errorMessage ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-foreground">
          <div className="flex items-start justify-between gap-3">
            <p>{errorMessage}</p>
            <Button size="sm" variant="ghost" type="button" onClick={onDismissError}>
              Dismiss
            </Button>
          </div>
        </div>
      ) : null}
      <SettingsSection id="general" title="General">
        <SettingsRow
          title="Active model"
          description="Choose the local speech model used for new dictation sessions."
          resetAction={getResetAction("activeModelId", "active model")}
        >
          <span className="rounded-md border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            {settings?.activeModelId ?? "Not selected"}
          </span>
        </SettingsRow>
        <SettingsRow
          title="Language"
          description="Auto keeps language detection enabled; explicit languages can reduce ambiguity."
          resetAction={getResetAction("language", "language")}
        >
          <SettingsSelect
            disabled={!settings}
            value={settings?.language ?? "auto"}
            options={[
              { label: "Auto", value: "auto" },
              { label: "English", value: "en" },
              { label: "Russian", value: "ru" },
            ]}
            onChange={(value) => updateSettings("language", value)}
          />
        </SettingsRow>
        <SettingsRow
          title="Post-processing"
          description="Transcript cleanup and provider settings now live in the dedicated post-processing section."
        >
          <Button size="sm" variant="outline" type="button" render={<Link to="/post-processing" />}>
            {
              postProcessingModeLabels[
                settings?.postProcessingMode ?? DEFAULT_APP_SETTINGS.postProcessingMode
              ]
            }
          </Button>
        </SettingsRow>
      </SettingsSection>
      <SettingsSection id="models" title="Models">
        <div className="border-t border-border/60 px-4 py-3.5 first:border-t-0 sm:px-5">
          <Button size="sm" variant="outline" type="button" onClick={onRefreshModelReadiness}>
            Refresh
          </Button>
        </div>
        {modelCatalog.map((model) => {
          const isExpanded = expandedModelId === model.id;

          return (
            <ModelCard
              active={settings?.activeModelId === model.id}
              bundleProgress={
                bundleInstallProgress?.modelId === model.id ? bundleInstallProgress : null
              }
              expanded={isExpanded}
              installedModel={
                installedModels.find((installed) => installed.modelId === model.id) ?? null
              }
              key={model.id}
              model={model}
              modelProgress={
                modelInstallProgress?.modelId === model.id ? modelInstallProgress : null
              }
              readiness={modelReadiness.find((record) => record.modelId === model.id) ?? null}
              variant="row"
              onCancelInstall={onCancelModelInstall}
              onInstall={onInstallModel}
              onSelect={(modelId) => updateSettings("activeModelId", modelId)}
              onToggleExpanded={() => setExpandedModelId(isExpanded ? null : model.id)}
            />
          );
        })}
      </SettingsSection>
      <SettingsSection id="dictation" title="Dictation">
        <SettingsRow
          title="Overlay position"
          description="Choose where the recording pill appears on screen."
          resetAction={getResetAction("overlayPosition", "overlay position")}
        >
          <div className="flex items-center justify-end gap-2 max-sm:flex-wrap max-sm:justify-start">
            <SettingsSelect
              disabled={!settings}
              value={settings?.overlayPosition ?? "bottom-center"}
              options={overlayPositionOptions}
              onChange={(value) => updateSettings("overlayPosition", value)}
            />
            <Button
              disabled={!settings || isRecording}
              size="sm"
              variant="outline"
              type="button"
              onClick={onShowOverlayPreview}
            >
              Preview
            </Button>
          </div>
        </SettingsRow>
        <SettingsRow
          title="Microphone"
          description="Choose the input device that will be used for local dictation recording."
          resetAction={getResetAction("microphoneDeviceId", "microphone")}
        >
          <SettingsSelect
            disabled={!settings}
            value={settings?.microphoneDeviceId ?? null}
            options={microphoneOptions}
            onChange={(value) => updateSettings("microphoneDeviceId", value)}
          />
        </SettingsRow>
        <SettingsRow
          title="Insertion mode"
          description="Paste is fastest; typing mode is useful for fields that block clipboard insertion."
          resetAction={getResetAction("insertionMode", "insertion mode")}
        >
          <SettingsSelect
            disabled={!settings}
            value={settings?.insertionMode ?? "paste"}
            options={[
              { label: "Paste", value: "paste" },
              { label: "Typing", value: "typing" },
              { label: "Hybrid", value: "hybrid" },
            ]}
            onChange={(value) => updateSettings("insertionMode", value)}
          />
        </SettingsRow>
        <SettingsRow
          title="Recording mode"
          description={
            recordingModeDescriptions[settings?.recordingMode ?? DEFAULT_APP_SETTINGS.recordingMode]
          }
          resetAction={getResetAction("recordingMode", "recording mode")}
        >
          <SettingsSelect
            disabled={!settings}
            value={settings?.recordingMode ?? DEFAULT_APP_SETTINGS.recordingMode}
            options={recordingModeOptions}
            onChange={(value) => updateSettings("recordingMode", value)}
          />
        </SettingsRow>
        <SettingsRow
          title="Test dictation"
          description={getTestDictationDescription(activeModelReadiness, settings?.activeModelId)}
        >
          <div className="flex flex-wrap justify-end gap-1.5 max-sm:justify-start">
            <Badge variant={isRecording ? "default" : "secondary"}>
              {isRecording ? "Recording" : "Idle"}
            </Badge>
            <Button
              disabled={isRecording || !canStartTestDictation}
              size="sm"
              variant="outline"
              type="button"
              onClick={onStartTestDictation}
            >
              Start test
            </Button>
            <Button disabled={!isRecording} size="sm" type="button" onClick={onStopTestDictation}>
              Stop
            </Button>
          </div>
        </SettingsRow>
      </SettingsSection>
      <SettingsSection id="history" title="History">
        <SettingsRow
          title="Transcript history"
          description="History stores final text transcripts locally for review and deletion."
          resetAction={getResetAction("historyEnabled", "transcript history")}
        >
          <SettingsSwitch
            disabled={!settings}
            checked={settings?.historyEnabled ?? true}
            onChange={(value) => updateSettings("historyEnabled", value)}
          />
        </SettingsRow>
        <SettingsRow
          title="Auto-delete"
          description="Remove local transcripts after the selected retention period."
          resetAction={getResetAction("autoDeleteHistoryDays", "history auto-delete")}
        >
          <SettingsSelect
            disabled={!settings}
            value={settings?.autoDeleteHistoryDays ?? null}
            options={[
              { label: "Never", value: null },
              { label: "7 days", value: 7 },
              { label: "30 days", value: 30 },
              { label: "90 days", value: 90 },
            ]}
            onChange={(value) => updateSettings("autoDeleteHistoryDays", value)}
          />
        </SettingsRow>
        <SettingsRow
          title="Clear history"
          description={`${transcriptCount} local transcript${transcriptCount === 1 ? "" : "s"} currently visible in history.`}
        >
          <Button size="sm" variant="outline" type="button" onClick={onClearTranscripts}>
            Clear
          </Button>
        </SettingsRow>
      </SettingsSection>
      <SettingsSection id="advanced" title="Advanced">
        <SettingsRow
          title="Model directory"
          description="Leave empty to keep installed models in the app-managed local storage directory."
          resetAction={getResetAction("modelDirectory", "model directory")}
        >
          <span className="max-w-[320px] truncate rounded-md border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            {settings?.modelDirectory ?? "App managed"}
          </span>
        </SettingsRow>
        <SettingsRow
          title="Hotkey"
          description="Global hold key used to open the overlay and start a dictation session."
          resetAction={getResetAction("hotkey", "hotkey")}
        >
          <div className="flex items-center justify-end gap-2 max-sm:flex-wrap max-sm:justify-start">
            <span className="flex min-w-[150px] justify-center rounded-md border bg-background px-3 py-1.5">
              {recordingHotkey && pressedHotkeyKeys.length === 0 ? (
                <span className="text-xs font-semibold text-muted-foreground">
                  Press shortcut...
                </span>
              ) : (
                <HotkeyKbd
                  hotkey={
                    recordingHotkey
                      ? normalizeHotkeyFromKeys(pressedHotkeyKeys)
                      : (settings?.hotkey ?? "CapsLock")
                  }
                />
              )}
            </span>
            <Button
              disabled={!settings}
              size="sm"
              variant="outline"
              type="button"
              onClick={() => setRecordingHotkey(true)}
            >
              Record
            </Button>
          </div>
        </SettingsRow>
      </SettingsSection>
    </div>
  );
};
