import { bundledModelCatalog } from "@molten-voice/model-catalog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ModelPickerProps {
  readonly activeModelId: string | null;
  readonly onSelectModel: (modelId: string) => void;
}

export const ModelPicker = ({ activeModelId, onSelectModel }: ModelPickerProps) => {
  return (
    <div className="grid grid-cols-3 gap-2.5 max-md:grid-cols-1">
      {bundledModelCatalog.map((model) => (
        <Card
          className={cn(
            "min-w-0 cursor-pointer gap-3 px-3 py-3 transition-colors",
            activeModelId === model.id && "border-primary bg-primary/10",
          )}
          key={model.id}
          role="button"
          tabIndex={0}
          onClick={() => onSelectModel(model.id)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onSelectModel(model.id);
            }
          }}
        >
          <CardHeader className="px-0">
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-sm">{model.displayName}</CardTitle>
              {activeModelId === model.id ? <Badge>Active</Badge> : null}
            </div>
            <CardDescription className="text-xs">{model.runtime}</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <dl className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[10px] font-bold uppercase text-muted-foreground">Languages</dt>
                <dd className="flex flex-wrap justify-end gap-1">
                  {model.languages.map((language) => (
                    <Badge variant="outline" key={language}>
                      {language}
                    </Badge>
                  ))}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[10px] font-bold uppercase text-muted-foreground">Memory</dt>
                <dd className="text-xs">
                  {Math.round(model.estimatedMemoryBytes / 1024 / 1024 / 1024)} GB
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
