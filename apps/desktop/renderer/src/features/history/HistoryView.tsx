import type { TranscriptRecord } from "@molten-voice/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

interface HistoryViewProps {
  readonly query: string;
  readonly transcripts: readonly TranscriptRecord[];
  readonly onQueryChange: (query: string) => void;
}

export const HistoryView = ({ query, transcripts, onQueryChange }: HistoryViewProps) => {
  return (
    <section className="min-w-0 border-l bg-card/70 p-3.5 max-[1040px]:hidden">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Local history
        </p>
        <h2 className="mt-1 text-[17px] font-semibold leading-tight">Recent transcripts</h2>
      </div>
      <Input
        className="my-4"
        placeholder="Search transcripts"
        value={query}
        onChange={(event) => onQueryChange(event.currentTarget.value)}
      />
      <Separator className="mb-3" />
      <div className="flex flex-col gap-2">
        {transcripts.map((item) => (
          <Card className="gap-2 px-3 py-3" key={item.id}>
            <CardContent className="flex flex-col gap-2 px-0">
              <p className="text-sm leading-snug">{item.text}</p>
              <time className="text-xs text-muted-foreground" dateTime={item.createdAt}>
                {item.createdAt}
              </time>
            </CardContent>
          </Card>
        ))}
        {transcripts.length === 0 ? (
          <p className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
            {query ? "No matching local transcripts." : "No local transcripts yet."}
          </p>
        ) : null}
      </div>
    </section>
  );
};
