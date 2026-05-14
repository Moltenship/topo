import type { AppSettings, InstalledModelRecord, ModelInstallProgress } from "@topo/shared";
import { getBundledModelCatalog } from "@topo/model-catalog";
import { Check } from "lucide-react";
import { HotkeyKbd } from "@/components/hotkey-kbd";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SelectionButton } from "@/components/ui/selection-button";
import { SegmentedControl, SettingsRow, SettingsSection } from "@/components/settings-layout";

interface DictationPageProps {
  readonly errorMessage: string | null;
  readonly installedModels: readonly InstalledModelRecord[];
  readonly isRecording: boolean;
  readonly modelInstallProgress: ModelInstallProgress | null;
  readonly settings: AppSettings | null;
  readonly onCancelModelInstall: (modelId: string) => void;
  readonly onDismissError: () => void;
  readonly onInstallModel: (modelId: string) => void;
  readonly onSettingsChange: (settings: AppSettings) => void;
  readonly onStartTestDictation: () => void;
  readonly onStopTestDictation: () => void;
}

const formatBytes = (bytes: number): string => `${Math.round(bytes / 1024 / 1024)} MB`;

export const DictationPage = ({
  errorMessage,
  installedModels,
  isRecording,
  modelInstallProgress,
  settings,
  onCancelModelInstall,
  onDismissError,
  onInstallModel,
  onSettingsChange,
  onStartTestDictation,
  onStopTestDictation,
}: DictationPageProps) => {
  const modelCatalog = getBundledModelCatalog({ includeDev: import.meta.env.DEV });

  const updateSettings = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    if (settings) {
      onSettingsChange({ ...settings, [key]: value });
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <div className="flex min-h-9 items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            Dictation
          </p>
          <h1 className="mt-1 text-sm font-semibold">Local voice workflow</h1>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          <Badge variant={isRecording ? "default" : "secondary"}>
            {isRecording ? "Recording" : "Idle"}
          </Badge>
          <Button
            disabled={isRecording}
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
      </div>
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
      <SettingsSection id="recorder" title="Recorder">
        <SettingsRow
          title="Hold-to-talk"
          description="Run a local microphone check without leaving the app surface."
        >
          <div className="flex flex-wrap justify-end gap-1.5 max-sm:justify-start">
            <HotkeyKbd hotkey={settings?.hotkey ?? "CapsLock"} />
            <Badge variant="secondary">{settings?.insertionMode ?? "paste"}</Badge>
            <Button
              disabled={isRecording}
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
        <SettingsRow
          title="Input preview"
          description="The test recorder keeps audio temporary and stores final text transcripts only."
        >
          <div className="flex h-12 w-[220px] items-center justify-center gap-1 rounded-lg border bg-background">
            {Array.from({ length: 26 }, (_, index) => (
              <span
                className="w-1 rounded-full bg-primary/80"
                key={index}
                style={{ height: `${10 + ((index * 13) % 28)}px` }}
              />
            ))}
          </div>
        </SettingsRow>
      </SettingsSection>
      <SettingsSection id="models" title="Models">
        {modelCatalog.map((model) => {
          const installedModel = installedModels.find(
            (installed) => installed.modelId === model.id,
          );
          const progress = modelInstallProgress?.modelId === model.id ? modelInstallProgress : null;
          const isInstalling =
            progress !== null && progress.status !== "installed" && progress.status !== "failed";
          const percent = Math.round((progress?.percent ?? 0) * 100);
          const isActive = settings?.activeModelId === model.id;

          return (
            <SettingsRow
              key={model.id}
              title={model.displayName}
              description={`${model.runtime} · ${formatBytes(model.estimatedMemoryBytes)} memory target`}
            >
              <div className="flex w-[320px] max-w-full flex-col items-end gap-2 max-sm:items-start">
                <div className="flex flex-wrap justify-end gap-1.5 max-sm:justify-start">
                  {model.devOnly ? <Badge variant="secondary">Dev</Badge> : null}
                  {installedModel ? (
                    <Badge
                      variant={
                        installedModel.verificationStatus === "verified" ? "default" : "secondary"
                      }
                    >
                      {installedModel.verificationStatus === "verified" ? "Installed" : "Repair"}
                    </Badge>
                  ) : null}
                  {isActive ? <Badge>Active</Badge> : null}
                </div>
                {progress ? (
                  <div className="w-full">
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
                <div className="flex flex-wrap justify-end gap-1.5 max-sm:justify-start">
                  <SelectionButton
                    selected={isActive}
                    selectedIcon={<Check className="size-3.5" />}
                    disabled={!settings}
                    size="sm"
                    type="button"
                    onClick={() => updateSettings("activeModelId", model.id)}
                  />
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
                </div>
              </div>
            </SettingsRow>
          );
        })}
      </SettingsSection>
      <SettingsSection id="preferences" title="Preferences">
        <SettingsRow title="Language" description="Auto keeps language detection enabled.">
          <SegmentedControl
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
          title="Insertion mode"
          description="Paste is fastest; typing is useful for fields that block clipboard insertion."
        >
          <SegmentedControl
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
      </SettingsSection>
    </div>
  );
};
