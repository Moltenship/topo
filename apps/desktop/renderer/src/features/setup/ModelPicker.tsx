import type { InstalledModelRecord, ModelInstallProgress } from "@molten-voice/shared";
import { getBundledModelCatalog } from "@molten-voice/model-catalog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ModelPickerProps {
  readonly activeModelId: string | null;
  readonly installedModels: readonly InstalledModelRecord[];
  readonly installProgress: ModelInstallProgress | null;
  readonly onCancelModelInstall: (modelId: string) => void;
  readonly onInstallModel: (modelId: string) => void;
  readonly onSelectModel: (modelId: string) => void;
}

const formatBytes = (bytes: number): string => `${Math.round(bytes / 1024 / 1024)} MB`;

export const ModelPicker = ({
  activeModelId,
  installedModels,
  installProgress,
  onCancelModelInstall,
  onInstallModel,
  onSelectModel,
}: ModelPickerProps) => {
  const modelCatalog = getBundledModelCatalog({ includeDev: import.meta.env.DEV });

  return (
    <div className="grid grid-cols-3 gap-2.5 max-md:grid-cols-1">
      {modelCatalog.map((model) => {
        const progress = installProgress?.modelId === model.id ? installProgress : null;
        const installedModel = installedModels.find((installed) => installed.modelId === model.id);
        const isInstalling =
          progress !== null && progress.status !== "installed" && progress.status !== "failed";
        const percent = Math.round((progress?.percent ?? 0) * 100);

        return (
          <Card
            className={cn(
              "min-w-0 cursor-pointer gap-3 px-3 py-3 transition-colors",
              activeModelId === model.id && "border-primary bg-primary/10",
            )}
            key={model.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelectModel(model.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelectModel(model.id);
              }
            }}
          >
            <CardHeader className="px-0">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-sm">{model.displayName}</CardTitle>
                <div className="flex flex-wrap justify-end gap-1">
                  {installedModel ? (
                    <Badge
                      variant={
                        installedModel.verificationStatus === "verified" ? "default" : "secondary"
                      }
                    >
                      {installedModel.verificationStatus === "verified" ? "Installed" : "Repair"}
                    </Badge>
                  ) : null}
                  {model.devOnly ? <Badge variant="secondary">Dev</Badge> : null}
                  {activeModelId === model.id ? <Badge>Active</Badge> : null}
                </div>
              </div>
              <CardDescription className="text-xs">{model.runtime}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 px-0">
              <dl className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[10px] font-bold uppercase text-muted-foreground">
                    Languages
                  </dt>
                  <dd className="flex flex-wrap justify-end gap-1">
                    {model.languages.map((language) => (
                      <Badge variant="outline" key={language}>
                        {language}
                      </Badge>
                    ))}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-[10px] font-bold uppercase text-muted-foreground">Memory</dt>
                  <dd className="text-xs">
                    {Math.round(model.estimatedMemoryBytes / 1024 / 1024 / 1024)} GB
                  </dd>
                </div>
              </dl>
              {progress ? (
                <div className="grid gap-1.5">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="font-semibold capitalize">{progress.status}</span>
                    <span className="text-muted-foreground">
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
              ) : null}
              <div className="grid grid-cols-2 gap-1.5">
                <Button
                  className={!isInstalling ? "col-span-2" : undefined}
                  size="sm"
                  variant="outline"
                  disabled={isInstalling}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onInstallModel(model.id);
                  }}
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
                    onClick={(event) => {
                      event.stopPropagation();
                      onCancelModelInstall(model.id);
                    }}
                  >
                    Cancel
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
