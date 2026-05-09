import { Minus, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getRendererApi } from "@/api/renderer-api";
import { BrandMark } from "./BrandMark";
import { cn } from "@/lib/utils";

const titleBarButtonClass =
  "app-region-no-drag size-8 rounded-md border border-transparent text-muted-foreground shadow-none hover:bg-accent hover:text-foreground";

export const AppTitleBar = () => {
  const api = getRendererApi();
  const isMac = api.platform === "macos";

  return (
    <header className="app-region-drag grid h-9 grid-cols-[1fr_auto_1fr] items-center border-b bg-card/80 px-2 text-foreground">
      <div className={cn("flex items-center gap-2", isMac && "pl-[76px]")}>
        <span className="grid size-5 place-items-center rounded border bg-secondary text-[9px] font-extrabold text-primary">
          MV
        </span>
        <BrandMark className="text-[12px]" />
      </div>
      <div className="text-[11px] font-semibold text-muted-foreground">Local dictation</div>
      {isMac ? (
        <div aria-hidden="true" />
      ) : (
        <div className="flex justify-end gap-1">
          <Button
            aria-label="Minimize window"
            className={titleBarButtonClass}
            size="icon"
            type="button"
            variant="ghost"
            onClick={() => void api.minimizeWindow()}
          >
            <Minus className="size-3.5" />
          </Button>
          <Button
            aria-label="Maximize window"
            className={titleBarButtonClass}
            size="icon"
            type="button"
            variant="ghost"
            onClick={() => void api.toggleMaximizeWindow()}
          >
            <Square className="size-3" />
          </Button>
          <Button
            aria-label="Close window"
            className="app-region-no-drag size-8 rounded-md border border-transparent text-muted-foreground shadow-none hover:bg-destructive hover:text-white"
            size="icon"
            type="button"
            variant="ghost"
            onClick={() => void api.closeWindow()}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      )}
    </header>
  );
};
