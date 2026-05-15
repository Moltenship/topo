import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { Loader2, Pause, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AudioPlayerItem {
  readonly id: string;
  readonly src: string;
}

interface AudioPlayerContextValue {
  readonly currentItemId: string | null;
  readonly currentTime: number;
  readonly duration: number;
  readonly isLoading: boolean;
  readonly isPlaying: boolean;
  readonly playbackRate: number;
  readonly playItem: (item: AudioPlayerItem) => void;
  readonly reset: (itemId?: string) => void;
  readonly seek: (time: number) => void;
  readonly setPlaybackRate: (rate: number) => void;
}

const AudioPlayerContext = createContext<AudioPlayerContextValue | null>(null);

const useAudioPlayer = () => {
  const context = useContext(AudioPlayerContext);

  if (!context) {
    throw new Error("Audio player components must be rendered inside AudioPlayerProvider.");
  }

  return context;
};

const formatTime = (time: number) => {
  if (!Number.isFinite(time) || time <= 0) {
    return "0:00";
  }

  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60)
    .toString()
    .padStart(2, "0");

  return `${minutes}:${seconds}`;
};

function AudioPlayerProvider({ children }: { readonly children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentItem, setCurrentItem] = useState<AudioPlayerItem | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRateState] = useState(1);

  const reset = useCallback(
    (itemId?: string) => {
      if (itemId && currentItem?.id !== itemId) {
        return;
      }

      const audio = audioRef.current;

      if (audio) {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      }

      setCurrentItem(null);
      setCurrentTime(0);
      setDuration(0);
      setIsLoading(false);
      setIsPlaying(false);
    },
    [currentItem],
  );

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio || !currentItem) {
      return;
    }

    audio.src = currentItem.src;
    audio.playbackRate = playbackRate;
    audio.load();
    setIsLoading(true);
    void audio.play().catch(() => {
      setIsPlaying(false);
      setIsLoading(false);
    });
  }, [currentItem]);

  useEffect(() => {
    const audio = audioRef.current;

    if (audio) {
      audio.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const value = useMemo<AudioPlayerContextValue>(
    () => ({
      currentItemId: currentItem?.id ?? null,
      currentTime,
      duration,
      isLoading,
      isPlaying,
      playbackRate,
      playItem: (item) => {
        const audio = audioRef.current;

        if (currentItem?.id === item.id && audio) {
          if (audio.paused) {
            setIsPlaying(true);
            void audio.play().catch(() => setIsPlaying(false));
          } else {
            audio.pause();
            setIsPlaying(false);
          }
          return;
        }

        setCurrentItem(item);
        setCurrentTime(0);
        setDuration(0);
        setIsPlaying(true);
      },
      reset,
      seek: (time) => {
        const audio = audioRef.current;

        if (!audio || !Number.isFinite(duration)) {
          return;
        }

        audio.currentTime = Math.min(Math.max(time, 0), duration);
        setCurrentTime(audio.currentTime);
      },
      setPlaybackRate: (rate) => setPlaybackRateState(rate),
    }),
    [currentItem, currentTime, duration, isLoading, isPlaying, playbackRate, reset],
  );

  return (
    <AudioPlayerContext.Provider value={value}>
      {children}
      <audio
        ref={audioRef}
        className="hidden"
        onCanPlay={() => setIsLoading(false)}
        onDurationChange={(event) => setDuration(event.currentTarget.duration || 0)}
        onEnded={() => setIsPlaying(false)}
        onError={() => {
          setCurrentTime(0);
          setDuration(0);
          setIsLoading(false);
          setIsPlaying(false);
        }}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
      />
    </AudioPlayerContext.Provider>
  );
}

function AudioPlayerButton({
  item,
  children,
  className,
  ...props
}: Omit<ComponentProps<typeof Button>, "children"> & {
  readonly item: AudioPlayerItem;
  readonly children?: ReactNode;
}) {
  const player = useAudioPlayer();
  const isCurrentItem = player.currentItemId === item.id;
  const isLoading = isCurrentItem && player.isLoading;
  const isPlaying = isCurrentItem && player.isPlaying;

  return (
    <Button
      aria-label={isPlaying ? "Pause audio" : "Play audio"}
      className={className}
      type="button"
      onClick={() => player.playItem(item)}
      {...props}
    >
      {children ??
        (isLoading ? <Loader2 className="animate-spin" /> : isPlaying ? <Pause /> : <Play />)}
    </Button>
  );
}

function AudioPlayerProgress({
  className,
  itemId,
  ...props
}: Omit<ComponentProps<"input">, "children" | "max" | "min" | "type" | "value"> & {
  readonly itemId?: string;
}) {
  const player = useAudioPlayer();
  const isCurrentItem = !itemId || player.currentItemId === itemId;
  const duration = isCurrentItem && Number.isFinite(player.duration) ? player.duration : 0;
  const currentTime = isCurrentItem ? player.currentTime : 0;

  return (
    <input
      aria-label="Seek audio"
      className={cn(
        "h-5 min-w-24 accent-primary disabled:opacity-50",
        "[&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-md [&::-webkit-slider-runnable-track]:bg-muted",
        "[&::-webkit-slider-thumb]:mt-[-4px] [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:rounded-full",
        className,
      )}
      disabled={!isCurrentItem || duration <= 0}
      max={duration}
      min={0}
      step="0.01"
      type="range"
      value={Math.min(Math.max(currentTime, 0), duration)}
      onChange={(event) => player.seek(event.currentTarget.valueAsNumber)}
      {...props}
    />
  );
}

function AudioPlayerTime({
  className,
  itemId,
  ...props
}: ComponentProps<"span"> & { readonly itemId?: string }) {
  const player = useAudioPlayer();
  const currentTime = !itemId || player.currentItemId === itemId ? player.currentTime : 0;

  return (
    <span className={cn("text-[11px] tabular-nums text-muted-foreground", className)} {...props}>
      {formatTime(currentTime)}
    </span>
  );
}

function AudioPlayerDuration({
  className,
  itemId,
  ...props
}: ComponentProps<"span"> & { readonly itemId?: string }) {
  const player = useAudioPlayer();
  const duration = !itemId || player.currentItemId === itemId ? player.duration : 0;

  return (
    <span className={cn("text-[11px] tabular-nums text-muted-foreground", className)} {...props}>
      {formatTime(duration)}
    </span>
  );
}

function AudioPlayerSpeed({
  className,
  rates = [1, 1.5, 2],
  ...props
}: ComponentProps<"button"> & { readonly rates?: readonly number[] }) {
  const player = useAudioPlayer();

  return (
    <button
      className={cn(
        "h-6 rounded-md px-1.5 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
        className,
      )}
      type="button"
      onClick={() => {
        const currentIndex = rates.indexOf(player.playbackRate);
        player.setPlaybackRate(rates[(currentIndex + 1) % rates.length] ?? 1);
      }}
      {...props}
    >
      {player.playbackRate}x
    </button>
  );
}

export {
  AudioPlayerButton,
  AudioPlayerDuration,
  AudioPlayerProgress,
  AudioPlayerProvider,
  AudioPlayerSpeed,
  AudioPlayerTime,
  useAudioPlayer,
};
