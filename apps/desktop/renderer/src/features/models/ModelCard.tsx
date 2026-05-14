import type {
  InstallBundleProgress,
  InstalledModelRecord,
  ModelInstallProgress,
  ModelReadinessRecord,
} from "@topo/shared";
import type { ModelCatalogEntry } from "@topo/model-catalog";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ModelCardProps {
  readonly active: boolean;
  readonly expanded?: boolean;
  readonly installedModel: InstalledModelRecord | null;
  readonly model: ModelCatalogEntry;
  readonly modelProgress: ModelInstallProgress | null;
  readonly bundleProgress: InstallBundleProgress | null;
  readonly readiness: ModelReadinessRecord | null;
  readonly selectable?: boolean;
  readonly variant?: "card" | "row";
  readonly onCancelInstall: (modelId: string) => void;
  readonly onInstall: (modelId: string) => void;
  readonly onSelect: (modelId: string) => void;
  readonly onToggleExpanded?: () => void;
}

const formatBytes = (bytes: number): string => {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / 1024 / 1024 / 1024).toFixed(bytes % (1024 * 1024 * 1024) === 0 ? 0 : 1)} GB`;
  }

  return `${Math.round(bytes / 1024 / 1024)} MB`;
};

const runtimeLabel = (model: ModelCatalogEntry): string =>
  model.runtimeRequirement.supportedRuntimeIds.length > 0
    ? model.runtimeRequirement.supportedRuntimeIds.join(", ")
    : model.runtimeRequirement.engine;

const readinessLabel = (readiness: ModelReadinessRecord | null): string => {
  if (!readiness) {
    return "Not checked";
  }

  if (readiness.status === "not-installed") {
    return "Not installed";
  }

  if (readiness.status === "runtime-missing") {
    return "Runtime missing";
  }

  if (readiness.status === "runtime-failed") {
    return "Runtime failed";
  }

  return "Ready";
};

const dotClassName = (
  readiness: ModelReadinessRecord | null,
  isInstalling: boolean,
  needsRepair: boolean,
): string => {
  if (isInstalling) {
    return "bg-primary";
  }

  if (needsRepair || readiness?.status === "runtime-missing") {
    return "bg-amber-500";
  }

  if (readiness?.status === "runtime-failed") {
    return "bg-destructive";
  }

  if (readiness?.status === "ready") {
    return "bg-emerald-500";
  }

  return "bg-muted-foreground/35";
};

const ScoreBar = ({ label, value }: { readonly label: string; readonly value: number }) => (
  <div className="grid gap-1">
    <div className="flex items-center justify-between gap-3 text-[11px]">
      <span className="font-semibold text-muted-foreground">{label}</span>
      <span className="tabular-nums text-foreground">{value}</span>
    </div>
    <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
      <div className="h-full rounded-full bg-primary" style={{ width: `${value}%` }} />
    </div>
  </div>
);

const ProgressBar = ({
  label,
  progress,
}: {
  readonly label: string;
  readonly progress: ModelInstallProgress;
}) => {
  const percent = Math.round(progress.percent * 100);

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-3 text-[11px]">
        <span className="font-semibold capitalize">
          {label}: {progress.status}
        </span>
        <span className="tabular-nums text-muted-foreground">
          {formatBytes(progress.receivedBytes)} / {formatBytes(progress.totalBytes)}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};

export const ModelCard = ({
  active,
  expanded = true,
  installedModel,
  model,
  modelProgress,
  bundleProgress,
  readiness,
  selectable = true,
  variant = "card",
  onCancelInstall,
  onInstall,
  onSelect,
  onToggleExpanded,
}: ModelCardProps) => {
  const runtimeProgress =
    bundleProgress?.modelId === model.id && bundleProgress.runtimeProgress
      ? bundleProgress.runtimeProgress
      : null;
  const effectiveModelProgress =
    bundleProgress?.modelId === model.id && bundleProgress.modelProgress
      ? bundleProgress.modelProgress
      : modelProgress;
  const isInstalling =
    (effectiveModelProgress !== null &&
      effectiveModelProgress.status !== "installed" &&
      effectiveModelProgress.status !== "failed") ||
    (runtimeProgress !== null &&
      runtimeProgress.status !== "installed" &&
      runtimeProgress.status !== "failed");
  const needsRepair = installedModel !== null && installedModel.verificationStatus !== "verified";
  const isInstalled = installedModel?.verificationStatus === "verified";
  const statusLabel = isInstalling
    ? (bundleProgress?.stage ??
      effectiveModelProgress?.status ??
      runtimeProgress?.status ??
      "installing")
    : needsRepair
      ? "Needs repair"
      : readiness
        ? readinessLabel(readiness)
        : isInstalled
          ? "Installed"
          : model.devOnly
            ? "Dev model"
            : "Not installed";
  const percent = Math.round(
    (effectiveModelProgress?.percent ?? runtimeProgress?.percent ?? 0) * 100,
  );
  const canActivate = selectable && isInstalled && readiness?.status === "ready";
  const showExpandedBody = variant === "card" || expanded;

  return (
    <div
      className={cn(
        "min-w-0 border-border/70 bg-card text-card-foreground",
        variant === "card" && "rounded-lg border p-3.5",
        variant === "row" && "border-t px-4 py-3.5 first:border-t-0 sm:px-5",
        active && "border-primary bg-primary/10",
      )}
    >
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <button
          className="min-w-0 flex-1 text-left"
          type="button"
          onClick={() => (onToggleExpanded ? onToggleExpanded() : onSelect(model.id))}
        >
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                "size-2 shrink-0 rounded-full",
                dotClassName(readiness, isInstalling, needsRepair),
              )}
              aria-hidden="true"
            />
            <span className="truncate text-[13px] font-semibold text-foreground">
              {model.displayName}
            </span>
            {model.badges.map((badge) => (
              <Badge className="h-5 px-1.5 text-[10px]" variant="secondary" key={badge}>
                {badge}
              </Badge>
            ))}
          </div>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {statusLabel} - {model.recommendedReason}
          </p>
        </button>
        <div className="flex shrink-0 items-center justify-end gap-2 max-sm:justify-start">
          {variant === "row" && onToggleExpanded ? (
            <button
              aria-expanded={expanded}
              aria-label={`${expanded ? "Collapse" : "Expand"} ${model.displayName}`}
              className="app-region-no-drag flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              type="button"
              onClick={onToggleExpanded}
            >
              <ChevronDown
                className={cn("size-3.5 transition-transform", expanded && "rotate-180")}
              />
            </button>
          ) : null}
          <Button
            disabled={!canActivate}
            size="sm"
            variant={active ? "secondary" : "outline"}
            type="button"
            onClick={() => onSelect(model.id)}
          >
            {active ? "Selected" : "Select"}
          </Button>
        </div>
      </div>
      {showExpandedBody ? (
        <div className={cn("grid gap-3", variant === "card" ? "mt-3" : "mt-3 border-t pt-3")}>
          <div className="grid grid-cols-2 gap-2">
            <ScoreBar label="Speed" value={model.speedScore} />
            <ScoreBar label="Accuracy" value={model.accuracyScore} />
          </div>
          <dl className="grid gap-2 text-xs sm:grid-cols-2">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Languages</dt>
              <dd className="text-right font-medium uppercase">{model.languages.join(", ")}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Runtime</dt>
              <dd className="text-right font-medium">{runtimeLabel(model)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Download</dt>
              <dd className="font-medium">{formatBytes(model.downloadSizeBytes)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Disk</dt>
              <dd className="font-medium">{formatBytes(model.diskSizeBytes)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Memory</dt>
              <dd className="font-medium">{formatBytes(model.estimatedMemoryBytes)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Quality</dt>
              <dd className="font-medium capitalize">{model.qualityLabel}</dd>
            </div>
          </dl>
          {runtimeProgress ? <ProgressBar label="Runtime" progress={runtimeProgress} /> : null}
          {effectiveModelProgress ? (
            <ProgressBar label="Model" progress={effectiveModelProgress} />
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            {!model.devOnly ? (
              <Button
                disabled={isInstalling}
                size="sm"
                variant="outline"
                type="button"
                onClick={() => onInstall(model.id)}
              >
                {isInstalling
                  ? `${percent}%`
                  : installedModel
                    ? installedModel.verificationStatus === "verified"
                      ? "Reinstall"
                      : "Repair"
                    : effectiveModelProgress?.status === "installed"
                      ? "Reinstall"
                      : "Install"}
              </Button>
            ) : null}
            {isInstalling ? (
              <Button
                size="sm"
                variant="secondary"
                type="button"
                onClick={() => onCancelInstall(model.id)}
              >
                Cancel
              </Button>
            ) : null}
            {readiness?.message ? (
              <p className="min-w-[180px] flex-1 text-xs text-muted-foreground">
                {readiness.message}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
};
