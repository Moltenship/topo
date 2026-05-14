import type { AppSettings } from "@topo/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SettingsStripProps {
  readonly settings: AppSettings | null;
  readonly onSettingsChange: (settings: AppSettings) => void;
}

const languageOptions = [
  { value: "auto", label: "Auto" },
  { value: "en", label: "English" },
  { value: "ru", label: "Russian" },
] as const;

const processingOptions = [
  { value: "lightweight", label: "Clean" },
  { value: "raw", label: "Raw" },
] as const;

const insertionOptions = [
  { value: "paste", label: "Paste" },
  { value: "typing", label: "Typing" },
  { value: "hybrid", label: "Hybrid" },
] as const;

export const SettingsStrip = ({ settings, onSettingsChange }: SettingsStripProps) => {
  const updateSettings = (patch: Partial<AppSettings>) => {
    if (settings) {
      onSettingsChange({ ...settings, ...patch });
    }
  };

  return (
    <Card className="gap-3 px-3 py-3">
      <CardHeader className="px-0">
        <CardTitle className="text-sm">Dictation settings</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-3 gap-3 px-0 max-lg:grid-cols-1">
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-bold uppercase text-muted-foreground">Language</p>
          <div className="flex flex-wrap gap-1.5">
            {languageOptions.map((option) => (
              <Button
                className={cn(
                  settings?.language === option.value && "border-primary bg-primary/10",
                )}
                disabled={!settings}
                key={option.value}
                size="sm"
                type="button"
                variant="outline"
                onClick={() => updateSettings({ language: option.value })}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-bold uppercase text-muted-foreground">Text</p>
          <div className="flex flex-wrap gap-1.5">
            {processingOptions.map((option) => (
              <Button
                className={cn(
                  settings?.postProcessingMode === option.value && "border-primary bg-primary/10",
                )}
                disabled={!settings}
                key={option.value}
                size="sm"
                type="button"
                variant="outline"
                onClick={() => updateSettings({ postProcessingMode: option.value })}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-bold uppercase text-muted-foreground">Insertion</p>
          <div className="flex flex-wrap gap-1.5">
            {insertionOptions.map((option) => (
              <Button
                className={cn(
                  settings?.insertionMode === option.value && "border-primary bg-primary/10",
                )}
                disabled={!settings}
                key={option.value}
                size="sm"
                type="button"
                variant="outline"
                onClick={() => updateSettings({ insertionMode: option.value })}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
