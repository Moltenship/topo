import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
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

    await repository.insert({
      id: "tr_1",
      text: "hello molten voice",
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
    });

    await repository.insert({
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
    });

    const results = await repository.list("molten");

    expect(results).toHaveLength(1);
    expect(results[0]?.text).toBe("hello molten voice");
  });
});
