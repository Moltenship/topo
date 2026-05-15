import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { transcripts } from "./schema";
import { createTranscriptRepository } from "./transcript-repository";

const createMemoryRepository = () => {
  const sqlite = new Database(":memory:");
  sqlite.exec(`
    CREATE TABLE transcripts (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      duration_ms INTEGER NOT NULL,
      model_id TEXT NOT NULL,
      runtime TEXT NOT NULL,
      language TEXT NOT NULL,
      recording_mode TEXT NOT NULL,
      stop_reason TEXT NOT NULL,
      insertion_mode TEXT NOT NULL,
      insertion_status TEXT NOT NULL,
      target_app_name TEXT
    )
  `);
  return createTranscriptRepository(drizzle(sqlite, { schema: { transcripts } }));
};

describe("createTranscriptRepository", () => {
  it("stores and searches transcript records without audio", async () => {
    const repository = createMemoryRepository();

    const results = await Effect.runPromise(
      Effect.gen(function* () {
        yield* repository.insert({
          id: "tr_1",
          text: "hello topo",
          createdAt: "2026-05-07T00:00:00.000Z",
          durationMs: 1200,
          modelId: "whisper-cpp-small",
          runtime: "whisper-cpp",
          language: "en",
          recordingMode: "push-to-talk",
          stopReason: "hotkey-release",
          insertionMode: "paste",
          insertionStatus: "inserted",
          targetAppName: "Test App",
          audioFileName: null,
          audioMimeType: null,
          audioByteSize: null,
        });

        yield* repository.insert({
          id: "tr_2",
          text: "privet mir",
          createdAt: "2026-05-07T00:01:00.000Z",
          durationMs: 900,
          modelId: "whisper-cpp-small",
          runtime: "whisper-cpp",
          language: "ru",
          recordingMode: "push-to-talk",
          stopReason: "hotkey-release",
          insertionMode: "paste",
          insertionStatus: "inserted",
          targetAppName: null,
          audioFileName: null,
          audioMimeType: null,
          audioByteSize: null,
        });

        return yield* repository.list("topo");
      }),
    );

    expect(results).toHaveLength(1);
    expect(results[0]?.text).toBe("hello topo");
  });

  it("returns transcript records by id", async () => {
    const repository = createMemoryRepository();

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        yield* repository.insert({
          id: "tr_lookup",
          text: "lookup transcript",
          createdAt: "2026-05-07T00:00:00.000Z",
          durationMs: 1200,
          modelId: "whisper-cpp-small",
          runtime: "whisper-cpp",
          language: "en",
          recordingMode: "push-to-talk",
          stopReason: "hotkey-release",
          insertionMode: "paste",
          insertionStatus: "inserted",
          targetAppName: "Test App",
          audioFileName: null,
          audioMimeType: null,
          audioByteSize: null,
        });

        return yield* repository.getById("tr_lookup");
      }),
    );

    expect(result?.text).toBe("lookup transcript");
  });

  it("rejects transcript audio metadata before audio columns are migrated", async () => {
    const repository = createMemoryRepository();

    await expect(
      Effect.runPromise(
        repository.insert({
          id: "tr_audio",
          text: "audio transcript",
          createdAt: "2026-05-07T00:00:00.000Z",
          durationMs: 1200,
          modelId: "whisper-cpp-small",
          runtime: "whisper-cpp",
          language: "en",
          recordingMode: "push-to-talk",
          stopReason: "hotkey-release",
          insertionMode: "paste",
          insertionStatus: "inserted",
          targetAppName: null,
          audioFileName: "tr_audio.wav",
          audioMimeType: "audio/wav",
          audioByteSize: 48,
        }),
      ),
    ).rejects.toThrow("Transcript audio metadata cannot be stored before audio columns exist.");
  });

  it("deletes transcript records created before a cutoff", async () => {
    const repository = createMemoryRepository();

    const results = await Effect.runPromise(
      Effect.gen(function* () {
        yield* repository.insert({
          id: "tr_old",
          text: "old transcript",
          createdAt: "2026-05-01T00:00:00.000Z",
          durationMs: 1200,
          modelId: "whisper-cpp-small",
          runtime: "whisper-cpp",
          language: "en",
          recordingMode: "push-to-talk",
          stopReason: "hotkey-release",
          insertionMode: "paste",
          insertionStatus: "inserted",
          targetAppName: null,
          audioFileName: null,
          audioMimeType: null,
          audioByteSize: null,
        });

        yield* repository.insert({
          id: "tr_recent",
          text: "recent transcript",
          createdAt: "2026-05-08T00:00:00.000Z",
          durationMs: 900,
          modelId: "whisper-cpp-small",
          runtime: "whisper-cpp",
          language: "en",
          recordingMode: "push-to-talk",
          stopReason: "hotkey-release",
          insertionMode: "paste",
          insertionStatus: "inserted",
          targetAppName: null,
          audioFileName: null,
          audioMimeType: null,
          audioByteSize: null,
        });

        yield* repository.deleteCreatedBefore("2026-05-07T00:00:00.000Z");

        return yield* repository.list();
      }),
    );

    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe("tr_recent");
  });
});
