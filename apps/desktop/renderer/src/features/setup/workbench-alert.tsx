import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface WorkbenchAlertProps {
  readonly message: string;
  readonly onDismiss: () => void;
}

export const WorkbenchAlert = ({ message, onDismiss }: WorkbenchAlertProps) => {
  return (
    <Card className="border-destructive/70 bg-destructive/10 px-3 py-3">
      <CardContent className="flex items-center justify-between gap-3 px-0">
        <p className="text-sm text-foreground">{message}</p>
        <Button size="sm" variant="ghost" onClick={onDismiss} type="button">
          Dismiss
        </Button>
      </CardContent>
    </Card>
  );
};
