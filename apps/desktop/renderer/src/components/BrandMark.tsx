import { cn } from "@/lib/utils";

export const BrandMark = ({ className }: { readonly className?: string }) => (
  <span className={cn("inline-flex items-baseline gap-1 text-sm font-semibold", className)}>
    <span className="text-foreground">Topo</span>
    <span className="ml-1 rounded-sm border px-1 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
      Alpha
    </span>
  </span>
);
