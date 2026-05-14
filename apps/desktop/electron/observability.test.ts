import { mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import {
  makeDesktopObservabilityLayer,
  makeDiagnosticsManifest,
  makeTopoRunId,
  resolveLogDirectory,
  topoMainLogger,
  TOPO_TRACE_FILE_NAME,
} from "./observability";

const readTraceRecords = (tracePath: string): ReadonlyArray<any> =>
  readFileSync(tracePath, "utf8")
    .trim()
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line));

describe("desktop observability", () => {
  it("resolves logs under userData", () => {
    expect(resolveLogDirectory({ userDataDirectory: "/tmp/topo" })).toBe("/tmp/topo/logs");
  });

  it("creates stable run ids", () => {
    expect(makeTopoRunId(new Date("2026-05-15T01:02:03.004Z"))).toMatch(
      /^topo-20260515-010203-[a-f0-9]{8}$/,
    );
  });

  it("redacts diagnostics manifest settings", () => {
    const manifest = makeDiagnosticsManifest({
      appVersion: "0.0.0",
      runId: "run-id",
      createdAt: "2026-05-15T01:02:03.004Z",
      platform: "darwin",
      arch: "arm64",
      isPackaged: false,
      logDirectory: "/tmp/topo/logs",
      tracePath: "/tmp/topo/logs/topo.trace.ndjson",
      settings: {
        activeModelId: "whisperkit-small",
        postProcessingApiProvider: {
          provider: "openai",
          modelId: "gpt-4.1-mini",
          apiKeyStorageKey: "secret-key-id",
          baseUrl: "https://api.openai.com/v1",
        },
      },
      installedModels: [],
      installedRuntimes: [],
      errorMessage: null,
    });

    expect(manifest.settings).toMatchObject({
      activeModelId: "whisperkit-small",
      postProcessingApiProvider: {
        provider: "openai",
        modelId: "gpt-4.1-mini",
        apiKeyStorageKey: "[REDACTED]",
      },
    });
  });

  it("writes desktop spans to topo trace file", async () => {
    const logDir = join(tmpdir(), `topo-desktop-observability-${crypto.randomUUID()}`);
    mkdirSync(logDir, { recursive: true });
    const tracePath = join(logDir, TOPO_TRACE_FILE_NAME);

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          yield* topoMainLogger.logInfo("desktop startup begin", {
            prompt: "do not persist this",
          });
        }).pipe(
          topoMainLogger.annotate({ runId: "run-id" }),
          Effect.withSpan("topo.desktop.bootstrap"),
          Effect.provide(
            makeDesktopObservabilityLayer({
              logDir,
              runId: "run-id",
              isPackaged: false,
              platform: "darwin",
              arch: "arm64",
            }),
          ),
        ),
      ),
    );

    const [record] = readTraceRecords(tracePath);
    expect(record).toMatchObject({
      name: "topo.desktop.bootstrap",
      attributes: {
        runId: "run-id",
        component: "electron-main",
      },
    });
    expect(JSON.stringify(record)).toContain("promptLength");
    expect(JSON.stringify(record)).not.toContain("do not persist this");
  });
});
