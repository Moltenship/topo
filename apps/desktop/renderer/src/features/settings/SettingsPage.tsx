import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_APP_SETTINGS,
  formatHotkey,
  normalizeHotkeyFromKeys,
  type AppSettings,
  type InstalledModelRecord,
  type ModelInstallProgress,
  type ModelReadinessRecord,
  type ModelReadinessStatus,
} from "@topo/shared";
import { getBundledModelCatalog } from "@topo/model-catalog";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

const formatBytes = (bytes: number): string => `${Math.round(bytes / 1024 / 1024)} MB`;

const overlayPositionOptions = [
  { label: "Bottom center", value: "bottom-center" },
  { label: "Top center", value: "top-center" },
  { label: "Bottom left", value: "bottom-left" },
  { label: "Bottom right", value: "bottom-right" },
  { label: "Center left", value: "center-left" },
  { label: "Center right", value: "center-right" },
] as const;

interface MicrophoneDeviceOption {
  readonly label: string;
  readonly value: string | null;
}

const readinessLabels = {
  "not-installed": "Not installed",
  "runtime-missing": "Runtime missing",
  "runtime-failed": "Runtime failed",
  ready: "Ready",
} satisfies Record<ModelReadinessStatus, string>;

const getReadinessDotClassName = (
  status: ModelReadinessStatus | "installing" | "unverified" | "installed-unprobed",
): string => {
  switch (status) {
    case "ready":
      return "size-2 shrink-0 rounded-full bg-emerald-500";
    case "runtime-missing":
      return "size-2 shrink-0 rounded-full bg-amber-500";
    case "runtime-failed":
      return "size-2 shrink-0 rounded-full bg-destructive";
    case "installing":
      return "size-2 shrink-0 rounded-full bg-primary";
    case "unverified":
    case "installed-unprobed":
      return "size-2 shrink-0 rounded-full bg-amber-500";
    case "not-installed":
      return "size-2 shrink-0 rounded-full bg-muted-foreground/35";
  }
};

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
  const modelCatalog = getBundledModelCatalog({ includeDev: import.meta.env.DEV });
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
          title="Text cleanup"
          description="Lightweight processing fixes obvious dictation artifacts before insertion."
          resetAction={getResetAction("postProcessingMode", "text cleanup")}
        >
          <SettingsSelect
            disabled={!settings}
            value={settings?.postProcessingMode ?? "lightweight"}
            options={[
              { label: "Clean", value: "lightweight" },
              { label: "Raw", value: "raw" },
            ]}
            onChange={(value) => updateSettings("postProcessingMode", value)}
          />
        </SettingsRow>
      </SettingsSection>
      <SettingsSection id="models" title="Models">
        <div className="border-t border-border/60 px-4 py-3.5 first:border-t-0 sm:px-5">
          <Button size="sm" variant="outline" type="button" onClick={onRefreshModelReadiness}>
            Refresh
          </Button>
        </div>
        {modelCatalog.map((model) => {
          const installedModel = installedModels.find(
            (installed) => installed.modelId === model.id,
          );
          const progress = modelInstallProgress?.modelId === model.id ? modelInstallProgress : null;
          const isInstalling =
            progress !== null && progress.status !== "installed" && progress.status !== "failed";
          const percent = Math.round((progress?.percent ?? 0) * 100);
          const isActive = settings?.activeModelId === model.id;
          const isInstalled = installedModel?.verificationStatus === "verified";
          const needsRepair =
            installedModel !== undefined && installedModel.verificationStatus !== "verified";
          const readiness = modelReadiness.find((record) => record.modelId === model.id);
          const canInstall = !model.devOnly;
          const isExpanded = expandedModelId === model.id;
          const readinessStatus = readiness?.status;
          const canActivate = isInstalled && readinessStatus === "ready";
          const statusLabel = isInstalling
            ? `${progress.status} ${percent}%`
            : needsRepair
              ? "Needs repair"
              : readinessStatus
                ? readinessLabels[readinessStatus]
                : isInstalled
                  ? "Installed"
                  : model.devOnly
                    ? "Dev smoke model"
                    : "Not installed";
          const dotStatus = isInstalling
            ? "installing"
            : needsRepair
              ? "unverified"
              : readinessStatus
                ? readinessStatus
                : isInstalled
                  ? "installed-unprobed"
                  : "not-installed";

          return (
            <div className="border-t border-border/60 first:border-t-0" key={model.id}>
              <div className="px-4 py-3.5 sm:px-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    className="min-w-0 flex-1 text-left"
                    type="button"
                    onClick={() => setExpandedModelId(isExpanded ? null : model.id)}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={getReadinessDotClassName(dotStatus)} aria-hidden="true" />
                      <span className="truncate text-[13px] font-semibold text-foreground">
                        {model.displayName}
                      </span>
                      {model.devOnly ? (
                        <span className="rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-foreground bg-muted">
                          Dev
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {statusLabel} - {model.runtime} - {formatBytes(model.estimatedMemoryBytes)}{" "}
                      memory target
                    </p>
                  </button>
                  <div className="flex shrink-0 items-center justify-end gap-2 max-sm:justify-start">
                    <button
                      aria-expanded={isExpanded}
                      aria-label={`${isExpanded ? "Collapse" : "Expand"} ${model.displayName}`}
                      className="app-region-no-drag flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      type="button"
                      onClick={() => setExpandedModelId(isExpanded ? null : model.id)}
                    >
                      <ChevronDown
                        className={`size-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      />
                    </button>
                    <SettingsSwitch
                      checked={isActive}
                      disabled={!settings || !canActivate}
                      onChange={(checked) =>
                        updateSettings("activeModelId", checked ? model.id : null)
                      }
                    />
                  </div>
                </div>
              </div>
              {isExpanded ? (
                <div className="border-t border-border/60 px-4 py-3.5 sm:px-5">
                  {progress ? (
                    <div className="mb-3">
                      <div className="mb-1 flex items-center justify-between gap-3 text-[11px]">
                        <span className="font-semibold capitalize">{progress.status}</span>
                        <span className="text-muted-foreground">
                          {formatBytes(progress.receivedBytes)} / {formatBytes(progress.totalBytes)}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-2">
                    {canInstall ? (
                      <Button
                        disabled={isInstalling}
                        size="sm"
                        variant="outline"
                        type="button"
                        onClick={() => onInstallModel(model.id)}
                      >
                        {isInstalling
                          ? `${percent}%`
                          : installedModel
                            ? installedModel.verificationStatus === "verified"
                              ? "Reinstall"
                              : "Repair"
                            : progress?.status === "installed"
                              ? "Reinstall"
                              : "Install"}
                      </Button>
                    ) : null}
                    {isInstalling ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        type="button"
                        onClick={() => onCancelModelInstall(model.id)}
                      >
                        Cancel
                      </Button>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      Installed models can be activated from the switch in the row header.
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
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
          description="One hotkey press starts recording; the next press stops and transcribes."
          resetAction={getResetAction("recordingMode", "recording mode")}
        >
          <span className="rounded-md border bg-background px-3 py-1.5 text-xs font-semibold">
            Press to start/stop
          </span>
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
            <span className="min-w-[150px] rounded-md border bg-background px-3 py-1.5 text-center text-xs font-semibold">
              {recordingHotkey
                ? pressedHotkeyKeys.length > 0
                  ? formatHotkey(normalizeHotkeyFromKeys(pressedHotkeyKeys))
                  : "Press shortcut..."
                : formatHotkey(settings?.hotkey ?? "CapsLock")}
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
