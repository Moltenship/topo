"use client";

import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface AudioAnalyserOptions {
  readonly fftSize?: number;
  readonly smoothingTimeConstant?: number;
  readonly minDecibels?: number;
  readonly maxDecibels?: number;
}

export interface MultiBandVolumeOptions {
  readonly bands?: number;
  readonly loPass?: number;
  readonly hiPass?: number;
  readonly updateInterval?: number;
  readonly analyserOptions?: AudioAnalyserOptions;
}

type AnimationState = "connecting" | "initializing" | "listening" | "speaking" | "thinking";

export type AgentState = AnimationState;

export interface BarVisualizerProps extends React.HTMLAttributes<HTMLDivElement> {
  readonly state?: AgentState;
  readonly barCount?: number;
  readonly mediaStream?: MediaStream | null;
  readonly minHeight?: number;
  readonly maxHeight?: number;
  readonly demo?: boolean;
  readonly centerAlign?: boolean;
}

const multibandDefaults = {
  bands: 5,
  loPass: 100,
  hiPass: 600,
  updateInterval: 32,
  analyserOptions: { fftSize: 2048 },
} satisfies MultiBandVolumeOptions;

const filledArray = (length: number, value: number): number[] =>
  Array.from({ length }, () => value);

const createAudioAnalyser = (mediaStream: MediaStream, options: AudioAnalyserOptions = {}) => {
  const AudioContextCtor =
    window.AudioContext ??
    (window as unknown as { readonly webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioContext = new AudioContextCtor();
  const source = audioContext.createMediaStreamSource(mediaStream);
  const analyser = audioContext.createAnalyser();

  if (options.fftSize) {
    analyser.fftSize = options.fftSize;
  }
  if (options.smoothingTimeConstant !== undefined) {
    analyser.smoothingTimeConstant = options.smoothingTimeConstant;
  }
  if (options.minDecibels !== undefined) {
    analyser.minDecibels = options.minDecibels;
  }
  if (options.maxDecibels !== undefined) {
    analyser.maxDecibels = options.maxDecibels;
  }

  source.connect(analyser);

  return {
    analyser,
    cleanup: () => {
      source.disconnect();
      void audioContext.close();
    },
  };
};

const normalizeDb = (value: number): number => {
  if (value === -Infinity) {
    return 0;
  }

  const minDb = -100;
  const maxDb = -10;
  const db = 1 - (Math.max(minDb, Math.min(maxDb, value)) * -1) / 100;
  return Math.sqrt(db);
};

export const useAudioVolume = (
  mediaStream?: MediaStream | null,
  options: AudioAnalyserOptions = { fftSize: 32, smoothingTimeConstant: 0 },
) => {
  const [volume, setVolume] = useState(0);
  const volumeRef = useRef(0);
  const frameId = useRef<number | undefined>(undefined);
  const memoizedOptions = useMemo(
    () => options,
    [options.fftSize, options.smoothingTimeConstant, options.minDecibels, options.maxDecibels],
  );

  useEffect(() => {
    if (!mediaStream) {
      setVolume(0);
      volumeRef.current = 0;
      return;
    }

    const { analyser, cleanup } = createAudioAnalyser(mediaStream, memoizedOptions);
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let lastUpdate = 0;

    const updateVolume = (timestamp: number) => {
      if (timestamp - lastUpdate >= 1000 / 30) {
        analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (const value of dataArray) {
          sum += value * value;
        }

        const nextVolume = Math.sqrt(sum / dataArray.length) / 255;
        if (Math.abs(nextVolume - volumeRef.current) > 0.01) {
          volumeRef.current = nextVolume;
          setVolume(nextVolume);
        }
        lastUpdate = timestamp;
      }

      frameId.current = requestAnimationFrame(updateVolume);
    };

    frameId.current = requestAnimationFrame(updateVolume);

    return () => {
      cleanup();
      if (frameId.current) {
        cancelAnimationFrame(frameId.current);
      }
    };
  }, [mediaStream, memoizedOptions]);

  return volume;
};

export const useMultibandVolume = (
  mediaStream?: MediaStream | null,
  options: MultiBandVolumeOptions = {},
) => {
  const opts = useMemo(
    () => ({ ...multibandDefaults, ...options }),
    [
      options.bands,
      options.loPass,
      options.hiPass,
      options.updateInterval,
      options.analyserOptions?.fftSize,
      options.analyserOptions?.smoothingTimeConstant,
      options.analyserOptions?.minDecibels,
      options.analyserOptions?.maxDecibels,
    ],
  );
  const [frequencyBands, setFrequencyBands] = useState<readonly number[]>(() =>
    filledArray(opts.bands, 0),
  );
  const bandsRef = useRef<readonly number[]>(filledArray(opts.bands, 0));
  const frameId = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!mediaStream) {
      const emptyBands = filledArray(opts.bands, 0);
      setFrequencyBands(emptyBands);
      bandsRef.current = emptyBands;
      return;
    }

    const { analyser, cleanup } = createAudioAnalyser(mediaStream, opts.analyserOptions);
    const dataArray = new Float32Array(analyser.frequencyBinCount);
    const sliceStart = opts.loPass;
    const sliceEnd = opts.hiPass;
    const chunkSize = Math.ceil((sliceEnd - sliceStart) / opts.bands);
    let lastUpdate = 0;

    const updateVolume = (timestamp: number) => {
      if (timestamp - lastUpdate >= opts.updateInterval) {
        analyser.getFloatFrequencyData(dataArray);

        const chunks = filledArray(opts.bands, 0);
        for (let index = 0; index < opts.bands; index++) {
          let sum = 0;
          let count = 0;
          const startIndex = sliceStart + index * chunkSize;
          const endIndex = Math.min(sliceStart + (index + 1) * chunkSize, sliceEnd);

          for (let dataIndex = startIndex; dataIndex < endIndex; dataIndex++) {
            sum += normalizeDb(dataArray[dataIndex] ?? -Infinity);
            count += 1;
          }

          chunks[index] = count > 0 ? sum / count : 0;
        }

        if (
          chunks.some((value, index) => Math.abs(value - (bandsRef.current[index] ?? 0)) > 0.01)
        ) {
          bandsRef.current = chunks;
          setFrequencyBands(chunks);
        }
        lastUpdate = timestamp;
      }

      frameId.current = requestAnimationFrame(updateVolume);
    };

    frameId.current = requestAnimationFrame(updateVolume);

    return () => {
      cleanup();
      if (frameId.current) {
        cancelAnimationFrame(frameId.current);
      }
    };
  }, [mediaStream, opts]);

  return frequencyBands;
};

export const useBarAnimator = (
  state: AnimationState | undefined,
  columns: number,
  interval: number,
): readonly number[] => {
  const indexRef = useRef(0);
  const [currentFrame, setCurrentFrame] = useState<readonly number[]>([]);
  const animationFrameId = useRef<number | null>(null);
  const sequence = useMemo(() => {
    if (state === "thinking" || state === "listening") {
      return generateListeningSequenceBar(columns);
    }
    if (state === "connecting" || state === "initializing") {
      return generateConnectingSequenceBar(columns);
    }
    if (state === undefined || state === "speaking") {
      return [Array.from({ length: columns }, (_, index) => index)];
    }

    return [[]];
  }, [state, columns]);

  useEffect(() => {
    indexRef.current = 0;
    setCurrentFrame(sequence[0] ?? []);
  }, [sequence]);

  useEffect(() => {
    let startTime = performance.now();

    const animate = (time: DOMHighResTimeStamp) => {
      if (time - startTime >= interval) {
        indexRef.current = (indexRef.current + 1) % sequence.length;
        setCurrentFrame(sequence[indexRef.current] ?? []);
        startTime = time;
      }

      animationFrameId.current = requestAnimationFrame(animate);
    };

    animationFrameId.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameId.current !== null) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [interval, sequence]);

  return currentFrame;
};

const generateConnectingSequenceBar = (columns: number): readonly (readonly number[])[] => {
  const sequence: number[][] = [];
  for (let index = 0; index < columns; index++) {
    sequence.push([index, columns - 1 - index]);
  }
  return sequence;
};

const generateListeningSequenceBar = (columns: number): readonly (readonly number[])[] => {
  const center = Math.floor(columns / 2);
  return [[center], [-1]];
};

const BarVisualizerComponent = React.forwardRef<HTMLDivElement, BarVisualizerProps>(
  (
    {
      state,
      barCount = 15,
      mediaStream,
      minHeight = 20,
      maxHeight = 100,
      demo = false,
      centerAlign = false,
      className,
      style,
      ...props
    },
    ref,
  ) => {
    const realVolumeBands = useMultibandVolume(mediaStream, {
      bands: barCount,
      loPass: 100,
      hiPass: 200,
    });
    const fakeVolumeBandsRef = useRef<readonly number[]>(filledArray(barCount, 0.2));
    const [fakeVolumeBands, setFakeVolumeBands] = useState<readonly number[]>(() =>
      filledArray(barCount, 0.2),
    );
    const fakeAnimationRef = useRef<number | undefined>(undefined);

    useEffect(() => {
      if (!demo) {
        return;
      }

      if (state !== "speaking" && state !== "listening") {
        const bands = filledArray(barCount, 0.2);
        fakeVolumeBandsRef.current = bands;
        setFakeVolumeBands(bands);
        return;
      }

      let lastUpdate = 0;
      const startTime = Date.now() / 1000;

      const updateFakeVolume = (timestamp: number) => {
        if (timestamp - lastUpdate >= 50) {
          const time = Date.now() / 1000 - startTime;
          const nextBands = filledArray(barCount, 0);

          for (let index = 0; index < barCount; index++) {
            const baseVolume = Math.sin(time * 2 + index * 0.5) * 0.3 + 0.5;
            nextBands[index] = Math.max(0.1, Math.min(1, baseVolume + Math.random() * 0.2));
          }

          if (
            nextBands.some(
              (value, index) => Math.abs(value - (fakeVolumeBandsRef.current[index] ?? 0)) > 0.05,
            )
          ) {
            fakeVolumeBandsRef.current = nextBands;
            setFakeVolumeBands(nextBands);
          }

          lastUpdate = timestamp;
        }

        fakeAnimationRef.current = requestAnimationFrame(updateFakeVolume);
      };

      fakeAnimationRef.current = requestAnimationFrame(updateFakeVolume);

      return () => {
        if (fakeAnimationRef.current) {
          cancelAnimationFrame(fakeAnimationRef.current);
        }
      };
    }, [demo, state, barCount]);

    const volumeBands = useMemo(
      () => (demo ? fakeVolumeBands : realVolumeBands),
      [demo, fakeVolumeBands, realVolumeBands],
    );
    const highlightedIndices = useBarAnimator(
      state,
      barCount,
      state === "connecting"
        ? 2000 / barCount
        : state === "thinking"
          ? 150
          : state === "listening"
            ? 500
            : 1000,
    );

    return (
      <div
        ref={ref}
        data-state={state}
        className={cn(
          "relative flex justify-center gap-1.5",
          centerAlign ? "items-center" : "items-end",
          "h-32 w-full overflow-hidden rounded-lg bg-muted p-4",
          className,
        )}
        style={style}
        {...props}
      >
        {volumeBands.map((volume, index) => (
          <Bar
            key={index}
            heightPct={Math.min(maxHeight, Math.max(minHeight, volume * 100 + 5))}
            isHighlighted={highlightedIndices.includes(index)}
            state={state}
          />
        ))}
      </div>
    );
  },
);

const Bar = React.memo<{
  readonly heightPct: number;
  readonly isHighlighted: boolean;
  readonly state: AgentState | undefined;
}>(({ heightPct, isHighlighted, state }) => (
  <div
    data-slot="bar-visualizer-bar"
    data-highlighted={isHighlighted}
    className={cn(
      "max-w-[12px] min-w-[8px] flex-1 rounded-full bg-border transition-all duration-150 data-[highlighted=true]:bg-primary",
      state === "speaking" && "bg-primary",
      state === "thinking" && isHighlighted && "animate-pulse",
    )}
    style={{
      height: `${heightPct}%`,
      animationDuration: state === "thinking" ? "300ms" : undefined,
    }}
  />
));

Bar.displayName = "Bar";
BarVisualizerComponent.displayName = "BarVisualizerComponent";

export const BarVisualizer = React.memo(BarVisualizerComponent);
BarVisualizer.displayName = "BarVisualizer";
