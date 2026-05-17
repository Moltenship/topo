import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getRendererApi } from "@/api/renderer-api";
import { BrandMark } from "./brand-mark";
import { cn } from "@/lib/utils";

const restoreButtonClass =
  "app-region-no-drag h-8 rounded-lg border bg-background/60 px-3 text-xs font-semibold shadow-none hover:bg-accent hover:text-foreground";

interface AppTitleBarProps {
  readonly canRestoreDefaults: boolean;
  readonly onRestoreDefaults: () => void;
}

export const AppTitleBar = ({ canRestoreDefaults, onRestoreDefaults }: AppTitleBarProps) => {
  const api = getRendererApi();
  const isMac = api.platform === "macos";

  return (
    <header className="app-region-drag grid h-[52px] grid-cols-[208px_minmax(0,1fr)] bg-background text-foreground">
      <div
        className={cn(
          "flex h-full items-center border-r bg-card/70 pl-[22px]",
          isMac && "pl-[90px]",
        )}
      >
        <BrandMark className="text-[12px]" />
      </div>
      <div className="flex h-full min-w-0 items-center border-b px-5 wco:h-[env(titlebar-area-height)] wco:pr-[calc(100vw-env(titlebar-area-width)-env(titlebar-area-x)+1em)]">
        <div className="text-[12px] font-medium tracking-wide text-muted-foreground/70">
          Local dictation
        </div>
        <div className="ms-auto flex items-center justify-end gap-1">
          <Button
            className={restoreButtonClass}
            disabled={!canRestoreDefaults}
            size="sm"
            type="button"
            variant="outline"
            onClick={onRestoreDefaults}
          >
            <RotateCcw className="size-3.5" />
            Restore defaults
          </Button>
        </div>
      </div>
    </header>
  );
};
