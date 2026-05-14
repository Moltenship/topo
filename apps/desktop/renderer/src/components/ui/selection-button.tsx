import type { ComponentProps, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SelectionButtonProps = Omit<ComponentProps<typeof Button>, "children" | "variant"> & {
  readonly selected: boolean;
  readonly selectedLabel?: ReactNode;
  readonly unselectedLabel?: ReactNode;
  readonly selectedIcon?: ReactNode;
};

const SelectionButtonContent = ({
  hidden,
  icon,
  label,
}: {
  readonly hidden?: boolean;
  readonly icon?: ReactNode;
  readonly label: ReactNode;
}) => (
  <span
    aria-hidden={hidden}
    className={cn(
      "col-start-1 row-start-1 flex items-center justify-center gap-1",
      hidden && "invisible",
    )}
  >
    {icon}
    {label}
  </span>
);

function SelectionButton({
  className,
  selected,
  selectedIcon,
  selectedLabel = "Selected",
  unselectedLabel = "Select",
  ...props
}: SelectionButtonProps) {
  return (
    <Button
      className={className}
      variant={selected ? "secondary" : "outline"}
      aria-pressed={selected}
      {...props}
    >
      <span className="grid place-items-center">
        <SelectionButtonContent hidden={!selected} icon={selectedIcon} label={selectedLabel} />
        <SelectionButtonContent hidden={selected} label={unselectedLabel} />
      </span>
    </Button>
  );
}

export { SelectionButton };
