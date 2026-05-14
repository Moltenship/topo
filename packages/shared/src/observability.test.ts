import { mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import {
  compactTraceAttributes,
  makeComponentLogger,
  makeLocalFileTracer,
  makeTraceSink,
} from "./observability";

const readTraceRecords = (tracePath: string): ReadonlyArray<any> =>
  readFileSync(tracePath, "utf8")
    .trim()
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line));

describe("observability", () => {
  it("normalizes JSON-unsafe attributes", () => {
    const circular: Array<unknown> = ["alpha"];
    circular.push(circular);

    expect(
      compactTraceAttributes({
        circular,
        date: new Date("2026-05-15T00:00:00.000Z"),
        bigint: 42n,
      }),
    ).toEqual({
      circular: ["alpha", "[Circular]"],
      date: "2026-05-15T00:00:00.000Z",
      bigint: "42",
    });
  });

  it("flushes trace records to disk", async () => {
    const dir = join(tmpdir(), `topo-trace-${crypto.randomUUID()}`);
    mkdirSync(dir, { recursive: true });
    const tracePath = join(dir, "topo.trace.ndjson");

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const sink = yield* makeTraceSink({
            filePath: tracePath,
            maxBytes: 1024 * 1024,
            maxFiles: 2,
            batchWindowMs: 10_000,
          });

          sink.push({
            type: "effect-span",
            name: "topo.test.span",
            traceId: "trace-id",
            spanId: "span-id",
            sampled: true,
            kind: "internal",
            startTimeUnixNano: "1",
            endTimeUnixNano: "2",
            durationMs: 1,
            attributes: { modelId: "whisperkit-small" },
            events: [],
            links: [],
            exit: { _tag: "Success" },
          });
          yield* sink.close();
        }),
      ),
    );

    expect(readTraceRecords(tracePath)[0]).toMatchObject({
      name: "topo.test.span",
      attributes: { modelId: "whisperkit-small" },
    });
  });

  it("writes spans and captures log messages as span events", async () => {
    const dir = join(tmpdir(), `topo-local-tracer-${crypto.randomUUID()}`);
    mkdirSync(dir, { recursive: true });
    const tracePath = join(dir, "topo.trace.ndjson");
    const logger = makeComponentLogger("test-component");

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const tracer = yield* makeLocalFileTracer({
            filePath: tracePath,
            maxBytes: 1024 * 1024,
            maxFiles: 2,
            batchWindowMs: 10_000,
          });

          yield* logger
            .logInfo("model selected", {
              modelId: "whisperkit-small",
              prompt: "do not persist this",
            })
            .pipe(
              logger.annotate({ operation: "test" }),
              Effect.withSpan("topo.test.span"),
              Effect.withTracer(tracer),
            );
        }).pipe(Effect.withTracerEnabled(true)),
      ),
    );

    const [record] = readTraceRecords(tracePath);
    expect(record).toMatchObject({
      name: "topo.test.span",
      attributes: { component: "test-component", operation: "test" },
    });
    expect(record.events.some((event: any) => event.name === "model selected")).toBe(true);
    expect(JSON.stringify(record)).toContain("promptLength");
    expect(JSON.stringify(record)).not.toContain("do not persist this");
  });
});
