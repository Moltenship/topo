import { bundledModelCatalog } from "@molten-voice/model-catalog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const ModelPicker = () => {
  return (
    <div className="grid grid-cols-3 gap-2.5 max-md:grid-cols-1">
      {bundledModelCatalog.map((model) => (
        <Card className="min-w-0 gap-3 px-3 py-3" key={model.id}>
          <CardHeader className="px-0">
            <CardTitle className="text-sm">{model.displayName}</CardTitle>
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
