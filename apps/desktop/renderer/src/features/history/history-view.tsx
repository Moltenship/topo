import { useEffect, useRef, useState } from "react";
import type { TranscriptRecord } from "@topo/shared";
import {
  AudioPlayerButton,
  AudioPlayerDuration,
  AudioPlayerProgress,
  AudioPlayerProvider,
  AudioPlayerTime,
  useAudioPlayer,
} from "@/components/ui/audio-player";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { getRendererApi } from "@/api/renderer-api";
import { cn } from "@/lib/utils";

interface HistoryViewProps {
  readonly query: string;
  readonly transcripts: readonly TranscriptRecord[];
  readonly variant?: "panel" | "page";
  readonly onClear: () => void;
  readonly onCopy: (id: string) => void;
  readonly onDelete: (id: string) => void;
  readonly onQueryChange: (query: string) => void;
  readonly onReinsert: (id: string) => void;
}

export const HistoryView = ({
  query,
  transcripts,
  variant = "panel",
  onClear,
  onCopy,
  onDelete,
  onQueryChange,
  onReinsert,
}: HistoryViewProps) => {
  return (
    <section
      className={cn(
        "min-w-0 bg-card/70 p-3.5",
        variant === "panel" && "border-l max-[1040px]:hidden",
        variant === "page" && "h-full overflow-y-auto",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Local history
          </p>
          <h2 className="mt-1 text-[17px] font-semibold leading-tight">Recent transcripts</h2>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={transcripts.length === 0}
          onClick={onClear}
          type="button"
        >
          Clear
        </Button>
      </div>
      <Input
        className="my-4"
        placeholder="Search transcripts"
        value={query}
        onChange={(event) => onQueryChange(event.currentTarget.value)}
      />
      <Separator className="mb-3" />
      <AudioPlayerProvider>
        <HistoryAudioPlaybackReset transcripts={transcripts} />
        <div className="flex flex-col gap-2">
          {transcripts.map((item) => (
            <Card className="gap-2 px-3 py-3" key={item.id}>
              <CardContent className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-0">
                <div className="min-w-0">
                  <p className="text-sm leading-snug">{item.text}</p>
                  <time
                    className="mt-2 block text-xs text-muted-foreground"
                    dateTime={item.createdAt}
                  >
                    {item.createdAt}
                  </time>
                  {item.audioFileName !== null ? (
                    <TranscriptAudioPlayer transcriptId={item.id} />
                  ) : null}
                </div>
                <div className="flex flex-wrap justify-end gap-1">
                  <Button size="sm" variant="ghost" onClick={() => onCopy(item.id)} type="button">
                    Copy
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onReinsert(item.id)}
                    type="button"
                  >
                    Reinsert
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onDelete(item.id)} type="button">
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {transcripts.length === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
              {query ? "No matching local transcripts." : "No local transcripts yet."}
            </p>
          ) : null}
        </div>
      </AudioPlayerProvider>
    </section>
  );
};

const HistoryAudioPlaybackReset = ({
  transcripts,
}: {
  readonly transcripts: readonly TranscriptRecord[];
}) => {
  const { currentItemId, reset } = useAudioPlayer();

  useEffect(() => {
    if (currentItemId && !transcripts.some((transcript) => transcript.id === currentItemId)) {
      reset(currentItemId);
    }
  }, [currentItemId, reset, transcripts]);

  return null;
};

const TranscriptAudioPlayer = ({ transcriptId }: { readonly transcriptId: string }) => {
  const mountedRef = useRef(true);
  const resetAudioPlayerRef = useRef<(itemId?: string) => void>(() => {});
  const { reset } = useAudioPlayer();
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    resetAudioPlayerRef.current = reset;
  }, [reset]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (src) {
        resetAudioPlayerRef.current(transcriptId);
        URL.revokeObjectURL(src);
      }
    };
  }, [src, transcriptId]);

  const load = async () => {
    if (src || loading) {
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const audio = await getRendererApi().loadTranscriptAudio(transcriptId);
      const audioBuffer = new ArrayBuffer(audio.bytes.byteLength);
      new Uint8Array(audioBuffer).set(audio.bytes);
      const nextSrc = URL.createObjectURL(new Blob([audioBuffer], { type: audio.mimeType }));

      if (!mountedRef.current) {
        URL.revokeObjectURL(nextSrc);
        return;
      }

      setSrc(nextSrc);
    } catch (error) {
      if (mountedRef.current) {
        setErrorMessage(error instanceof Error ? error.message : "Unable to load audio.");
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  return (
    <div className="mt-2 flex min-h-7 items-center gap-2">
      {src ? (
        <>
          <AudioPlayerButton item={{ id: transcriptId, src }} size="icon-sm" variant="outline" />
          <AudioPlayerProgress className="w-full max-w-44" itemId={transcriptId} />
          <AudioPlayerTime itemId={transcriptId} />
          <span className="text-[11px] text-muted-foreground">/</span>
          <AudioPlayerDuration itemId={transcriptId} />
        </>
      ) : (
        <Button
          aria-describedby={loading ? `${transcriptId}-audio-status` : undefined}
          size="sm"
          variant="outline"
          disabled={loading}
          onClick={() => void load()}
        >
          {loading ? "Loading audio" : "Load audio"}
        </Button>
      )}
      {loading ? (
        <span
          id={`${transcriptId}-audio-status`}
          className="sr-only"
          role="status"
          aria-live="polite"
        >
          Loading transcript audio.
        </span>
      ) : null}
      {errorMessage ? (
        <span className="truncate text-[11px] text-destructive" role="alert">
          {errorMessage}
        </span>
      ) : null}
    </div>
  );
};
