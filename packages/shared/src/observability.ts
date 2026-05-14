import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import type * as Exit from "effect/Exit";
import * as ExitRuntime from "effect/Exit";
import * as Option from "effect/Option";
import { pipe } from "effect/Function";
import * as Tracer from "effect/Tracer";
import * as Context from "effect/Context";

import { redactLogAnnotations, RotatingFileSink, type LogAnnotations } from "./logging";

const FLUSH_BUFFER_THRESHOLD = 32;

export type TraceAttributes = Readonly<Record<string, unknown>>;

export interface TraceRecordEvent {
  readonly name: string;
  readonly timeUnixNano: string;
  readonly attributes: TraceAttributes;
}

export interface TraceRecordLink {
  readonly traceId: string;
  readonly spanId: string;
  readonly attributes: TraceAttributes;
}

export interface TraceRecord {
  readonly type: "effect-span";
  readonly name: string;
  readonly kind: string;
  readonly traceId: string;
  readonly spanId: string;
  readonly parentSpanId?: string;
  readonly sampled: boolean;
  readonly startTimeUnixNano: string;
  readonly endTimeUnixNano: string;
  readonly durationMs: number;
  readonly attributes: TraceAttributes;
  readonly events: ReadonlyArray<TraceRecordEvent>;
  readonly links: ReadonlyArray<TraceRecordLink>;
  readonly exit:
    | { readonly _tag: "Success" }
    | { readonly _tag: "Interrupted"; readonly cause: string }
    | { readonly _tag: "Failure"; readonly cause: string };
}

export interface TraceSinkOptions {
  readonly filePath: string;
  readonly maxBytes: number;
  readonly maxFiles: number;
  readonly batchWindowMs: number;
}

export interface TraceSink {
  readonly filePath: string;
  push: (record: TraceRecord) => void;
  readonly flush: Effect.Effect<void>;
  close: () => Effect.Effect<void>;
}

export interface LocalFileTracerOptions extends TraceSinkOptions {
  readonly delegate?: Tracer.Tracer;
  readonly sink?: TraceSink;
}

interface SerializableSpan {
  readonly name: string;
  readonly traceId: string;
  readonly spanId: string;
  readonly parent: Option.Option<Tracer.AnySpan>;
  readonly context: Context.Context<never>;
  readonly status: Tracer.SpanStatus;
  readonly sampled: boolean;
  readonly kind: Tracer.SpanKind;
  readonly attributes: ReadonlyMap<string, unknown>;
  readonly links: ReadonlyArray<Tracer.SpanLink>;
  readonly events: ReadonlyArray<
    readonly [name: string, startTime: bigint, attributes: Record<string, unknown>]
  >;
}

export interface ComponentLogger {
  readonly annotate: {
    <A, E, R>(effect: Effect.Effect<A, E, R>, annotations?: LogAnnotations): Effect.Effect<A, E, R>;
    (
      annotations?: LogAnnotations,
    ): <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>;
  };
  readonly logDebug: (message: string, annotations?: LogAnnotations) => Effect.Effect<void>;
  readonly logInfo: (message: string, annotations?: LogAnnotations) => Effect.Effect<void>;
  readonly logWarning: (message: string, annotations?: LogAnnotations) => Effect.Effect<void>;
  readonly logError: (message: string, annotations?: LogAnnotations) => Effect.Effect<void>;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function markSeen(value: object, seen: WeakSet<object>): boolean {
  if (seen.has(value)) {
    return true;
  }
  seen.add(value);
  return false;
}

function normalizeJsonValue(value: unknown, seen: WeakSet<object> = new WeakSet()): unknown {
  if (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value ?? null;
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "Invalid Date" : value.toISOString();
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      ...(value.stack ? { stack: value.stack } : {}),
    };
  }
  if (Array.isArray(value)) {
    if (markSeen(value, seen)) {
      return "[Circular]";
    }
    return value.map((entry) => normalizeJsonValue(entry, seen));
  }
  if (value instanceof Map) {
    if (markSeen(value, seen)) {
      return "[Circular]";
    }
    return Object.fromEntries(
      Array.from(value.entries(), ([key, entryValue]) => [
        String(key),
        normalizeJsonValue(entryValue, seen),
      ]),
    );
  }
  if (value instanceof Set) {
    if (markSeen(value, seen)) {
      return "[Circular]";
    }
    return Array.from(value.values(), (entry) => normalizeJsonValue(entry, seen));
  }
  if (!isPlainObject(value)) {
    return String(value);
  }
  if (markSeen(value, seen)) {
    return "[Circular]";
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => [key, normalizeJsonValue(entryValue, seen)]),
  );
}

export function compactTraceAttributes(
  attributes: Readonly<Record<string, unknown>>,
): TraceAttributes {
  return Object.fromEntries(
    Object.entries(redactLogAnnotations({ ...attributes }))
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, normalizeJsonValue(value)]),
  );
}

function formatTraceExit(exit: Exit.Exit<unknown, unknown>): TraceRecord["exit"] {
  if (ExitRuntime.isSuccess(exit)) {
    return { _tag: "Success" };
  }
  if (Cause.isInterruptedOnly(exit.cause)) {
    return { _tag: "Interrupted", cause: Cause.pretty(exit.cause) };
  }
  return { _tag: "Failure", cause: Cause.pretty(exit.cause) };
}

export function spanToTraceRecord(span: SerializableSpan): TraceRecord {
  const status = span.status as Extract<Tracer.SpanStatus, { _tag: "Ended" }>;
  const parentSpanId = Option.getOrUndefined(span.parent)?.spanId;

  return {
    type: "effect-span",
    name: span.name,
    traceId: span.traceId,
    spanId: span.spanId,
    ...(parentSpanId ? { parentSpanId } : {}),
    sampled: span.sampled,
    kind: span.kind,
    startTimeUnixNano: String(status.startTime),
    endTimeUnixNano: String(status.endTime),
    durationMs: Number(status.endTime - status.startTime) / 1_000_000,
    attributes: compactTraceAttributes(Object.fromEntries(span.attributes)),
    events: span.events.map(([name, startTime, attributes]) => ({
      name,
      timeUnixNano: String(startTime),
      attributes: compactTraceAttributes(attributes),
    })),
    links: span.links.map((link) => ({
      traceId: link.span.traceId,
      spanId: link.span.spanId,
      attributes: compactTraceAttributes(link.attributes),
    })),
    exit: formatTraceExit(status.exit),
  };
}

export const makeTraceSink = Effect.fn("makeTraceSink")(function* (options: TraceSinkOptions) {
  const sink = new RotatingFileSink({
    filePath: options.filePath,
    maxBytes: options.maxBytes,
    maxFiles: options.maxFiles,
  });
  let buffer: Array<string> = [];

  const flushUnsafe = () => {
    if (buffer.length === 0) {
      return;
    }

    const chunk = buffer.join("");
    buffer = [];
    sink.write(chunk);
  };
  const flush = Effect.sync(flushUnsafe).pipe(Effect.withTracerEnabled(false));

  yield* Effect.addFinalizer(() => flush.pipe(Effect.ignore));

  return {
    filePath: options.filePath,
    push(record) {
      try {
        buffer.push(`${JSON.stringify(record)}\n`);
        if (buffer.length >= FLUSH_BUFFER_THRESHOLD) {
          flushUnsafe();
        }
      } catch {
        return;
      }
    },
    flush,
    close: () => flush,
  } satisfies TraceSink;
});

class LocalFileSpan implements Tracer.Span {
  readonly _tag = "Span";
  readonly name: string;
  readonly spanId: string;
  readonly traceId: string;
  readonly parent: Option.Option<Tracer.AnySpan>;
  readonly context: Context.Context<never>;
  readonly links: Array<Tracer.SpanLink>;
  readonly sampled: boolean;
  readonly kind: Tracer.SpanKind;

  status: Tracer.SpanStatus;
  attributes: Map<string, unknown>;
  events: Array<[name: string, startTime: bigint, attributes: Record<string, unknown>]>;
  private readonly push: (record: TraceRecord) => void;

  constructor(
    options: {
      readonly name: string;
      readonly parent: Option.Option<Tracer.AnySpan>;
      readonly context: Context.Context<never>;
      readonly links: ReadonlyArray<Tracer.SpanLink>;
      readonly startTime: bigint;
      readonly kind: Tracer.SpanKind;
    },
    push: (record: TraceRecord) => void,
  ) {
    this.push = push;
    this.name = options.name;
    this.spanId = makeTraceId(16);
    this.traceId = Option.getOrUndefined(options.parent)?.traceId ?? makeTraceId(32);
    this.parent = options.parent;
    this.context = options.context;
    this.links = [...options.links];
    this.sampled = true;
    this.kind = options.kind;
    this.status = {
      _tag: "Started",
      startTime: options.startTime,
    };
    this.attributes = new Map();
    this.events = [];
  }

  end(endTime: bigint, exit: Exit.Exit<unknown, unknown>): void {
    this.status = {
      _tag: "Ended",
      startTime: this.status.startTime,
      endTime,
      exit,
    };
    if (this.sampled) {
      this.push(spanToTraceRecord(this));
    }
  }

  attribute(key: string, value: unknown): void {
    this.attributes.set(key, value);
  }

  event(name: string, startTime: bigint, attributes?: Record<string, unknown>): void {
    const nextAttributes = attributes ?? {};
    this.events.push([name, startTime, nextAttributes]);
  }

  addLinks(links: ReadonlyArray<Tracer.SpanLink>): void {
    this.links.push(...links);
  }
}

const makeTraceId = (length: number): string => {
  const alphabet = "abcdef0123456789";
  let value = "";
  for (let index = 0; index < length; index += 1) {
    value += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return value;
};

export const makeLocalFileTracer = Effect.fn("makeLocalFileTracer")(function* (
  options: LocalFileTracerOptions,
) {
  const sink =
    options.sink ??
    (yield* makeTraceSink({
      filePath: options.filePath,
      maxBytes: options.maxBytes,
      maxFiles: options.maxFiles,
      batchWindowMs: options.batchWindowMs,
    }));
  const delegate =
    options.delegate ??
    Tracer.make({
      span: (name, parent, context, links, startTime, kind) =>
        new LocalFileSpan({ name, parent, context, links, startTime, kind }, () => undefined),
      context: (f) => f(),
    });

  return Tracer.make({
    span(name, parent, context, links, startTime, kind) {
      return new LocalFileSpan({ name, parent, context, links, startTime, kind }, sink.push);
    },
    context: (f, fiber) => delegate.context(f, fiber),
  });
});

export function makeComponentLogger(component: string): ComponentLogger {
  const annotate: ComponentLogger["annotate"] = ((
    effectOrAnnotations?: unknown,
    annotations?: LogAnnotations,
  ) => {
    const apply = <A, E, R>(effect: Effect.Effect<A, E, R>, nextAnnotations?: LogAnnotations) =>
      pipe(
        effect,
        Effect.annotateLogs(compactTraceAttributes({ component, ...nextAnnotations })),
        Effect.tap(() =>
          Effect.annotateCurrentSpan(compactTraceAttributes({ component, ...nextAnnotations })),
        ),
      );

    if (Effect.isEffect(effectOrAnnotations)) {
      return apply(effectOrAnnotations, annotations);
    }

    return <A, E, R>(effect: Effect.Effect<A, E, R>) =>
      apply(effect, effectOrAnnotations as LogAnnotations | undefined);
  }) as ComponentLogger["annotate"];

  const logEvent = (
    level: "DEBUG" | "INFO" | "WARNING" | "ERROR",
    message: string,
    annotations?: LogAnnotations,
  ) =>
    annotate(
      Effect.currentSpan.pipe(
        Effect.tap((span) =>
          Effect.sync(() => {
            span.event(message, BigInt(Date.now()) * 1_000_000n, {
              "effect.logLevel": level,
              ...compactTraceAttributes({ component, ...annotations }),
            });
          }),
        ),
        Effect.catchAll(() => Effect.void),
      ),
      annotations,
    );

  return {
    annotate,
    logDebug: (message, annotations) => logEvent("DEBUG", message, annotations),
    logInfo: (message, annotations) => logEvent("INFO", message, annotations),
    logWarning: (message, annotations) => logEvent("WARNING", message, annotations),
    logError: (message, annotations) => logEvent("ERROR", message, annotations),
  };
}
