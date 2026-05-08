import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ModelPicker } from "./ModelPicker";
import { setupSteps } from "./setup-steps";

interface SetupFlowProps {
  readonly children?: ReactNode;
}

export const SetupFlow = ({ children }: SetupFlowProps) => {
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
            <h1 className="mt-0.5 text-[17px] font-semibold leading-none">Molten Voice</h1>
          </div>
        </div>
        <nav aria-label="Setup progress">
          <ol className="flex flex-col gap-1">
            {setupSteps.map((step, index) => (
              <li
                key={step.path}
                className={cn(
                  "grid min-h-9 grid-cols-[24px_minmax(0,1fr)] items-center gap-2.5 rounded-md border border-transparent px-2 py-1.5 text-sm text-muted-foreground",
                  index < 2 && "border-border bg-secondary/45 text-foreground",
                )}
              >
                <span className="grid size-[22px] place-items-center rounded-md bg-secondary text-[11px] font-extrabold text-primary">
                  {index + 1}
                </span>
                <strong className="min-w-0 truncate font-semibold">{step.title}</strong>
              </li>
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
            <Badge variant="secondary">Offline</Badge>
            <Badge variant="secondary">CapsLock</Badge>
            <Badge variant="secondary">Paste</Badge>
          </div>
        </Card>
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
        <ModelPicker />
      </section>
      {children}
    </>
  );
};
