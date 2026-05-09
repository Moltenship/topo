import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, Undo2 } from "lucide-react";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string | number | boolean | null> {
  readonly label: string;
  readonly value: T;
}

export const SettingsSection = ({
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
    <div className="rounded-2xl border bg-card text-card-foreground shadow-sm">{children}</div>
  </section>
);

export const SettingsRow = ({
  children,
  description,
  resetAction,
  title,
}: {
  readonly children: ReactNode;
  readonly description: string;
  readonly resetAction?: ReactNode;
  readonly title: ReactNode;
}) => (
  <div className="grid min-h-[68px] grid-cols-[minmax(0,1fr)_auto] items-center gap-6 border-t px-4 py-3.5 first:border-t-0 sm:px-5 max-sm:grid-cols-1 max-sm:gap-3">
    <div className="min-w-0">
      <div className="flex min-h-5 items-center gap-1.5">
        <h3 className="text-[13px] font-semibold tracking-normal text-foreground">{title}</h3>
        <span className="inline-flex size-5 shrink-0 items-center justify-center">
          {resetAction}
        </span>
      </div>
      <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground/80">
        {description}
      </p>
    </div>
    <div className="flex min-w-0 justify-end max-sm:justify-start">{children}</div>
  </div>
);

export const SettingResetButton = ({
  label,
  onClick,
}: {
  readonly label: string;
  readonly onClick: () => void;
}) => (
  <Tooltip>
    <TooltipTrigger
      render={
        <button
          aria-label={`Reset ${label} to default`}
          className="flex size-5 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:text-foreground"
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onClick();
          }}
        >
          <Undo2 className="size-3" />
        </button>
      }
    />
    <TooltipPopup side="top">Reset to default</TooltipPopup>
  </Tooltip>
);

export const SegmentedControl = <T extends string | number | boolean | null>({
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

export const SettingsSelect = <T extends string | number | null>({
  disabled = false,
  options,
  value,
  onChange,
}: {
  readonly disabled?: boolean;
  readonly options: readonly SegmentedOption<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);

    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div className="relative inline-flex min-w-[176px]" ref={rootRef}>
      <button
        aria-expanded={open}
        className="inline-flex h-9 w-full items-center justify-between gap-2 rounded-lg border bg-background/80 px-3 text-left text-[13px] font-semibold text-foreground shadow-xs outline-none transition-colors hover:bg-secondary/40 focus-visible:border-primary/70 disabled:pointer-events-none disabled:opacity-50"
        disabled={disabled}
        type="button"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="truncate">{selectedOption?.label ?? ""}</span>
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <div className="absolute right-0 top-[calc(100%+4px)] z-50 min-w-full overflow-hidden rounded-lg border bg-popover p-1 text-foreground shadow-lg">
          {options.map((option) => (
            <button
              className={cn(
                "flex min-h-8 w-full items-center rounded-md px-3 text-left text-[13px] font-semibold outline-none transition-colors hover:bg-accent hover:text-accent-foreground",
                option.value === value && "bg-accent text-accent-foreground",
              )}
              key={`${option.value}`}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export const SettingsSwitch = ({
  checked,
  disabled = false,
  onChange,
}: {
  readonly checked: boolean;
  readonly disabled?: boolean;
  readonly onChange: (checked: boolean) => void;
}) => (
  <button
    aria-checked={checked}
    className={cn(
      "relative h-6 w-11 rounded-full border border-transparent bg-secondary transition-colors disabled:pointer-events-none disabled:opacity-50",
      checked ? "bg-primary" : "bg-secondary",
    )}
    disabled={disabled}
    role="switch"
    type="button"
    onClick={() => onChange(!checked)}
  >
    <span
      className={cn(
        "absolute top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-full bg-foreground text-background shadow-sm transition-transform",
        checked ? "translate-x-[20px]" : "translate-x-0.5 bg-muted-foreground/40",
      )}
    >
      {checked ? <Check className="size-3" /> : null}
    </span>
  </button>
);
