import type { ReactNode } from "react";
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
    <div className="overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-sm">
      {children}
    </div>
  </section>
);

export const SettingsRow = ({
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
