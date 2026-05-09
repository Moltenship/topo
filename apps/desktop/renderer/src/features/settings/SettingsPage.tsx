import type { ComponentType, ReactNode } from "react";
import type { AppSettings, InstalledModelRecord, ModelInstallProgress } from "@molten-voice/shared";
import { getBundledModelCatalog } from "@molten-voice/model-catalog";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Archive, Check, Database, Mic2, RotateCcw, Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SettingsPageProps {
  readonly errorMessage: string | null;
  readonly installedModels: readonly InstalledModelRecord[];
  readonly isRecording: boolean;
  readonly modelInstallProgress: ModelInstallProgress | null;
  readonly settings: AppSettings | null;
  readonly transcriptCount: number;
  readonly onCancelModelInstall: (modelId: string) => void;
  readonly onClearTranscripts: () => void;
  readonly onDismissError: () => void;
  readonly onInstallModel: (modelId: string) => void;
  readonly onSettingsChange: (settings: AppSettings) => void;
  readonly onStartTestDictation: () => void;
  readonly onStopTestDictation: () => void;
}

interface NavItem {
  readonly id: string;
  readonly label: string;
  readonly icon: ComponentType<{ className?: string }>;
}

interface SegmentedOption<T extends string | number | boolean | null> {
  readonly label: string;
  readonly value: T;
}

const navItems: readonly NavItem[] = [
  { id: "general", label: "General", icon: Settings2 },
  { id: "models", label: "Models", icon: Database },
  { id: "dictation", label: "Dictation", icon: Mic2 },
  { id: "history", label: "History", icon: Archive },
];

const formatBytes = (bytes: number): string => `${Math.round(bytes / 1024 / 1024)} MB`;

const SettingsSection = ({
  children,
  id,
  title,
}: {
  readonly children: ReactNode;
  readonly id: string;
  readonly title: string;
}) => (
  <section className="space-y-2.5" id={id}>
    <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground/50">
      <span className="h-px w-3 bg-border" aria-hidden="true" />
      {title}
    </h2>
    <div className="overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-sm">
      {children}
    </div>
  </section>
);

const SettingsRow = ({
  children,
  description,
  title,
}: {
  readonly children: ReactNode;
  readonly description: string;
  readonly title: string;
}) => (
  <div className="grid min-h-[68px] grid-cols-[minmax(0,1fr)_auto] items-center gap-6 border-t px-4 py-3.5 first:border-t-0 sm:px-5 max-sm:grid-cols-1 max-sm:gap-3">
    <div className="min-w-0">
      <h3 className="text-[13px] font-semibold tracking-normal text-foreground">{title}</h3>
      <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground/80">
        {description}
      </p>
    </div>
    <div className="flex min-w-0 justify-end max-sm:justify-start">{children}</div>
  </div>
);

const SegmentedControl = <T extends string | number | boolean | null>({
  disabled = false,
  options,
  value,
  onChange,
}: {
  readonly disabled?: boolean;
  readonly options: readonly SegmentedOption<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
}) => (
  <div className="inline-flex rounded-lg border bg-background/70 p-0.5">
    {options.map((option) => (
      <button
        className={cn(
          "min-h-7 rounded-md px-3 text-xs font-semibold text-muted-foreground transition-colors disabled:pointer-events-none disabled:opacity-50",
          option.value === value && "bg-secondary text-foreground shadow-xs",
        )}
        disabled={disabled}
        key={`${option.value}`}
        type="button"
        onClick={() => onChange(option.value)}
      >
        {option.label}
      </button>
    ))}
  </div>
);

export const SettingsPage = ({
  errorMessage,
  installedModels,
  isRecording,
  modelInstallProgress,
  settings,
  transcriptCount,
  onCancelModelInstall,
  onClearTranscripts,
  onDismissError,
  onInstallModel,
  onSettingsChange,
  onStartTestDictation,
  onStopTestDictation,
}: SettingsPageProps) => {
  const modelCatalog = getBundledModelCatalog({ includeDev: import.meta.env.DEV });

  const updateSettings = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    if (settings) {
      onSettingsChange({ ...settings, [key]: value });
    }
  };

  return (
    <main className="grid h-full grid-cols-[208px_minmax(0,1fr)] overflow-hidden bg-background text-foreground max-md:h-auto max-md:min-h-full max-md:grid-cols-1 max-md:overflow-auto">
      <aside className="flex h-full flex-col overflow-hidden border-r bg-card/70 px-3 py-4 max-md:h-auto max-md:min-h-auto">
        <div className="mb-6 flex items-center gap-2 px-1">
          <span className="grid size-7 place-items-center rounded-md border bg-secondary text-[11px] font-extrabold text-foreground">
            MV
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold leading-none">Molten Voice</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Settings
            </p>
          </div>
        </div>
        <nav className="grid gap-1" aria-label="Settings sections">
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <a
                className="flex min-h-9 items-center gap-2 rounded-md px-2.5 text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground first:bg-accent first:text-foreground"
                href={`#${item.id}`}
                key={item.id}
              >
                <Icon className="size-4" />
                {item.label}
              </a>
            );
          })}
        </nav>
        <div className="mt-auto pt-6">
          <Button asChild className="w-full justify-start" size="sm" variant="ghost">
            <Link to="/">
              <ArrowLeft className="size-4" />
              Back
            </Link>
          </Button>
        </div>
      </aside>
      <section className="h-full overflow-y-auto px-6 py-8 max-md:h-auto max-md:min-h-auto max-sm:px-4">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
          <div className="flex min-h-9 items-center justify-between gap-4">
            <h1 className="text-sm font-semibold">Settings</h1>
            <Button size="sm" variant="outline" type="button">
              <RotateCcw className="size-3.5" />
              Restore defaults
            </Button>
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
          <SettingsSection id="general" title="General">
            <SettingsRow
              title="Active model"
              description="Choose the local speech model used for new dictation sessions."
            >
              <span className="rounded-md border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                {settings?.activeModelId ?? "Not selected"}
              </span>
            </SettingsRow>
            <SettingsRow
              title="Language"
              description="Auto keeps language detection enabled; explicit languages can reduce ambiguity."
            >
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
              title="Text cleanup"
              description="Lightweight processing fixes obvious dictation artifacts before insertion."
            >
              <SegmentedControl
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
            {modelCatalog.map((model) => {
              const installedModel = installedModels.find(
                (installed) => installed.modelId === model.id,
              );
              const progress =
                modelInstallProgress?.modelId === model.id ? modelInstallProgress : null;
              const isInstalling =
                progress !== null &&
                progress.status !== "installed" &&
                progress.status !== "failed";
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
                            installedModel.verificationStatus === "verified"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {installedModel.verificationStatus === "verified"
                            ? "Installed"
                            : "Repair"}
                        </Badge>
                      ) : null}
                      {isActive ? <Badge>Active</Badge> : null}
                    </div>
                    {progress ? (
                      <div className="w-full">
                        <div className="mb-1 flex items-center justify-between gap-3 text-[11px]">
                          <span className="font-semibold capitalize">{progress.status}</span>
                          <span className="text-muted-foreground">
                            {formatBytes(progress.receivedBytes)} /{" "}
                            {formatBytes(progress.totalBytes)}
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
                      <Button
                        disabled={!settings}
                        size="sm"
                        variant={isActive ? "secondary" : "outline"}
                        type="button"
                        onClick={() => updateSettings("activeModelId", model.id)}
                      >
                        {isActive ? <Check className="size-3.5" /> : null}
                        {isActive ? "Selected" : "Select"}
                      </Button>
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
          <SettingsSection id="dictation" title="Dictation">
            <SettingsRow
              title="Insertion mode"
              description="Paste is fastest; typing mode is useful for fields that block clipboard insertion."
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
            <SettingsRow
              title="Recording mode"
              description="Push-to-talk keeps the recorder scoped to the current hold action."
            >
              <span className="rounded-md border bg-background px-3 py-1.5 text-xs font-semibold">
                {settings?.recordingMode ?? "push-to-talk"}
              </span>
            </SettingsRow>
            <SettingsRow
              title="Test dictation"
              description="Start a local recording session from settings to verify microphone and insertion flow."
            >
              <div className="flex flex-wrap justify-end gap-1.5 max-sm:justify-start">
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
                <Button
                  disabled={!isRecording}
                  size="sm"
                  type="button"
                  onClick={onStopTestDictation}
                >
                  Stop
                </Button>
              </div>
            </SettingsRow>
          </SettingsSection>
          <SettingsSection id="history" title="History">
            <SettingsRow
              title="Transcript history"
              description="History stores final text transcripts locally for review and deletion."
            >
              <SegmentedControl
                disabled={!settings}
                value={settings?.historyEnabled ?? true}
                options={[
                  { label: "On", value: true },
                  { label: "Off", value: false },
                ]}
                onChange={(value) => updateSettings("historyEnabled", value)}
              />
            </SettingsRow>
            <SettingsRow
              title="Stored transcripts"
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
            >
              <span className="max-w-[320px] truncate rounded-md border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                {settings?.modelDirectory ?? "App managed"}
              </span>
            </SettingsRow>
            <SettingsRow
              title="Hotkey"
              description="Global hold key used to open the overlay and start a dictation session."
            >
              <span className="rounded-md border bg-background px-3 py-1.5 text-xs font-semibold">
                {settings?.hotkey ?? "CapsLock"}
              </span>
            </SettingsRow>
          </SettingsSection>
        </div>
      </section>
    </main>
  );
};
