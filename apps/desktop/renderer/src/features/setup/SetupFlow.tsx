import type { ReactNode } from "react";
import type { AppSettings, InstalledModelRecord, ModelInstallProgress } from "@topo/shared";
import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ModelPicker } from "./ModelPicker";
import { SettingsStrip } from "./SettingsStrip";
import { setupSteps } from "./setup-steps";
import { WorkbenchAlert } from "./WorkbenchAlert";

interface SetupFlowProps {
  readonly children?: ReactNode;
  readonly isRecording: boolean;
  readonly errorMessage: string | null;
  readonly installedModels: readonly InstalledModelRecord[];
  readonly settings: AppSettings | null;
  readonly modelInstallProgress?: ModelInstallProgress | null;
  readonly onDismissError: () => void;
  readonly onCancelModelInstall: (modelId: string) => void;
  readonly onInstallModel: (modelId: string) => void;
  readonly onStartTestDictation: () => void;
  readonly onStopTestDictation: () => void;
  readonly onSettingsChange: (settings: AppSettings) => void;
}

export const SetupFlow = ({
  children,
  isRecording,
  errorMessage,
  installedModels,
  settings,
  modelInstallProgress = null,
  onDismissError,
  onCancelModelInstall,
  onInstallModel,
  onStartTestDictation,
  onStopTestDictation,
  onSettingsChange,
}: SetupFlowProps) => {
  return (
    <>
      <aside className="min-h-screen border-r bg-card/70 p-3.5 max-md:min-h-auto">
        <div className="grid grid-cols-[38px_minmax(0,1fr)] items-center gap-3 px-1.5 pb-5 pt-2">
          <span className="grid size-[38px] place-items-center rounded-lg border bg-secondary text-xs font-extrabold text-primary">
            MV
          </span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Local system layer
            </p>
            <h1 className="mt-0.5 text-[17px] font-semibold leading-none">Topo</h1>
          </div>
        </div>
        <nav className="mb-4 grid grid-cols-3 gap-1" aria-label="Workspace">
          {[
            { to: "/", label: "Flow" },
            { to: "/history", label: "History" },
            { to: "/", label: "General" },
          ].map((item) => (
            <Link
              activeProps={{ className: "border-primary bg-primary/10 text-primary" }}
              className="rounded-md border border-transparent px-2 py-1.5 text-center text-xs font-semibold text-muted-foreground"
              key={item.to}
              to={item.to}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <nav aria-label="Setup progress">
          <ol className="flex flex-col gap-1">
            {setupSteps.map((step, index) => (
              <Link
                activeProps={{ className: "border-primary bg-primary/10 text-primary" }}
                className={cn(
                  "grid min-h-9 grid-cols-[24px_minmax(0,1fr)] items-center gap-2.5 rounded-md border border-transparent px-2 py-1.5 text-sm text-muted-foreground",
                  index < 2 && "border-border bg-secondary/45 text-foreground",
                )}
                key={step.path}
                params={{ step: step.path.replace("/setup/", "") }}
                to="/setup/$step"
              >
                <span className="grid size-[22px] place-items-center rounded-md bg-secondary text-[11px] font-extrabold text-primary">
                  {index + 1}
                </span>
                <strong className="min-w-0 truncate font-semibold">{step.title}</strong>
              </Link>
            ))}
          </ol>
        </nav>
      </aside>
      <section className="grid min-h-screen min-w-0 grid-rows-[auto_minmax(250px,1fr)_auto] gap-3.5 bg-background p-4.5 max-md:min-h-auto">
        <Card className="min-h-[72px] flex-row items-center justify-between gap-4 px-4 py-3.5 max-md:items-start max-md:flex-col">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Hold-to-talk
            </p>
            <h2 className="mt-1 text-xl font-semibold leading-tight">Ready for local dictation</h2>
          </div>
          <div className="flex flex-wrap justify-end gap-1.5" aria-label="Dictation status">
            <Badge variant={isRecording ? "default" : "secondary"}>
              {isRecording ? "Recording" : "Offline"}
            </Badge>
            <Badge variant="secondary">CapsLock</Badge>
            <Badge variant="secondary">Paste</Badge>
            <Button
              size="sm"
              variant="outline"
              disabled={isRecording}
              onClick={onStartTestDictation}
              type="button"
            >
              Start test
            </Button>
            <Button size="sm" disabled={!isRecording} onClick={onStopTestDictation} type="button">
              Stop
            </Button>
          </div>
        </Card>
        {errorMessage ? <WorkbenchAlert message={errorMessage} onDismiss={onDismissError} /> : null}
        <Card className="min-h-0 gap-0 overflow-hidden py-0">
          <CardContent className="flex min-h-0 flex-1 items-center justify-center gap-1.5 bg-accent/15 px-7 py-9">
            {Array.from({ length: 38 }, (_, index) => (
              <span
                className="max-h-[92px] w-1.5 rounded-full bg-primary/75"
                key={index}
                style={{ height: `${18 + ((index * 17) % 54)}px` }}
              />
            ))}
          </CardContent>
          <CardFooter className="justify-between gap-4 border-t px-4 py-3.5 text-sm text-muted-foreground max-md:flex-col max-md:items-start">
            <p>Selected input remains focused while the overlay records from the system edge.</p>
            <strong className="shrink-0 text-xs text-primary">
              Audio is temporary. Transcript history stores text only.
            </strong>
          </CardFooter>
        </Card>
        <ModelPicker
          activeModelId={settings?.activeModelId ?? null}
          installedModels={installedModels}
          installProgress={modelInstallProgress}
          onCancelModelInstall={onCancelModelInstall}
          onInstallModel={onInstallModel}
          onSelectModel={(modelId) => {
            if (settings) {
              onSettingsChange({ ...settings, activeModelId: modelId });
            }
          }}
        />
        <SettingsStrip settings={settings} onSettingsChange={onSettingsChange} />
      </section>
      {children}
    </>
  );
};
