import type { ReactNode } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { Archive, Settings2, WandSparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface AppShellProps {
  readonly children: ReactNode;
}

const navItems = [
  { to: "/", label: "General", icon: Settings2 },
  { to: "/post-processing", label: "Post-processing", icon: WandSparkles },
  { to: "/history", label: "History", icon: Archive },
] as const;

export const AppShell = ({ children }: AppShellProps) => {
  const location = useLocation();

  return (
    <main className="grid h-full grid-cols-[208px_minmax(0,1fr)] overflow-hidden bg-background text-foreground max-md:h-auto max-md:min-h-full max-md:grid-cols-1 max-md:overflow-auto">
      <aside className="flex h-full flex-col overflow-hidden border-r bg-card/70 px-3 py-3 max-md:h-auto max-md:min-h-auto">
        <nav aria-label="Application sections">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.to;

            return (
              <Link
                className={cn(
                  "flex min-h-9 items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] transition-colors",
                  isActive
                    ? "font-medium text-foreground"
                    : "text-muted-foreground/70 hover:text-foreground/80",
                )}
                key={item.to}
                to={item.to}
              >
                <Icon className="size-4 shrink-0" />
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
};
