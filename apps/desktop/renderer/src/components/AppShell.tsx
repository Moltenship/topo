import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Archive, Mic2, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AppShellProps {
  readonly children: ReactNode;
}

const navItems = [
  { to: "/", label: "Dictation", icon: Mic2 },
  { to: "/history", label: "History", icon: Archive },
  { to: "/settings", label: "Settings", icon: Settings2 },
] as const;

export const AppShell = ({ children }: AppShellProps) => (
  <main className="grid h-full grid-cols-[208px_minmax(0,1fr)] overflow-hidden bg-background text-foreground max-md:h-auto max-md:min-h-full max-md:grid-cols-1 max-md:overflow-auto">
    <aside className="flex h-full flex-col overflow-hidden border-r bg-card/70 px-3 py-4 max-md:h-auto max-md:min-h-auto">
      <div className="mb-6 flex items-center gap-2 px-1">
        <span className="grid size-7 place-items-center rounded-md border bg-secondary text-[11px] font-extrabold text-foreground">
          MV
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold leading-none">Molten Voice</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            Local dictation
          </p>
        </div>
      </div>
      <nav className="grid gap-1" aria-label="Application sections">
        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              activeProps={{ className: "bg-accent text-foreground" }}
              className={cn(
                "flex min-h-9 items-center gap-2 rounded-md px-2.5 text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
              )}
              key={item.to}
              to={item.to}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
    <section className="h-full overflow-y-auto px-6 py-8 max-md:h-auto max-md:min-h-auto max-sm:px-4">
      {children}
    </section>
  </main>
);
