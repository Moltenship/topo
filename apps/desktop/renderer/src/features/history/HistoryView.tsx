import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

const demoTranscripts = [
  { id: "1", text: "Hello world", createdAt: "2026-05-07 09:00" },
  { id: "2", text: "Privet mir", createdAt: "2026-05-07 09:05" },
];

export const HistoryView = () => {
  return (
    <section className="min-w-0 border-l bg-card/70 p-3.5 max-[1040px]:hidden">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Local history
        </p>
        <h2 className="mt-1 text-[17px] font-semibold leading-tight">Recent transcripts</h2>
      </div>
      <Input className="my-4" placeholder="Search transcripts" />
      <Separator className="mb-3" />
      <div className="flex flex-col gap-2">
        {demoTranscripts.map((item) => (
          <Card className="gap-2 px-3 py-3" key={item.id}>
            <CardContent className="flex flex-col gap-2 px-0">
              <p className="text-sm leading-snug">{item.text}</p>
              <time className="text-xs text-muted-foreground">{item.createdAt}</time>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
};
