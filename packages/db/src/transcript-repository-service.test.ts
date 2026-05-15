import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { transcripts } from "./schema";
import {
  TranscriptRepositoryService,
  makeTranscriptRepositoryLayer,
} from "./transcript-repository-service";

const makeMemoryLayer = () => {
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
      target_app_name TEXT,
      audio_file_name TEXT,
      audio_mime_type TEXT,
      audio_byte_size INTEGER
    )
  `);

  return makeTranscriptRepositoryLayer(drizzle(sqlite, { schema: { transcripts } }));
};

describe("TranscriptRepositoryService", () => {
  it("provides repository operations through an Effect layer", async () => {
    const program = Effect.gen(function* () {
      const repository = yield* TranscriptRepositoryService;

      yield* repository.insert({
        id: "tr_layer_1",
        text: "layer backed transcript",
        createdAt: "2026-05-08T00:00:00.000Z",
        durationMs: 800,
        modelId: "whisper-cpp-small",
        runtime: "whisper-cpp",
        language: "en",
        recordingMode: "push-to-talk",
        stopReason: "hotkey-release",
        insertionMode: "paste",
        insertionStatus: "inserted",
        targetAppName: "Layer Test",
        audioFileName: null,
        audioMimeType: null,
        audioByteSize: null,
      });

      return yield* repository.list("layer backed");
    });

    const results = await Effect.runPromise(Effect.provide(program, makeMemoryLayer()));

    expect(results).toHaveLength(1);
    expect(results[0]?.targetAppName).toBe("Layer Test");
  });

  it("supports overriding the service in tests", async () => {
    const fakeLayer = Layer.succeed(TranscriptRepositoryService, {
      insert: () => Effect.void,
      getById: () => Effect.succeed(null),
      getAudioFileNameById: () => Effect.succeed(null),
      getAudioFileNamesCreatedBefore: () => Effect.succeed([]),
      listAudioFileNames: () => Effect.succeed([]),
      list: () =>
        Effect.succeed([
          {
            id: "fake",
            text: "fake transcript",
            createdAt: "2026-05-08T00:00:00.000Z",
            durationMs: 1,
            modelId: "fake-model",
            runtime: "fake-runtime",
            language: "en",
            recordingMode: "push-to-talk",
            stopReason: "hotkey-release",
            insertionMode: "paste",
            insertionStatus: "skipped",
            targetAppName: null,
            audioFileName: null,
            audioMimeType: null,
            audioByteSize: null,
          },
        ]),
      deleteById: () => Effect.void,
      deleteCreatedBefore: () => Effect.void,
      clear: () => Effect.void,
    });

    const results = await Effect.runPromise(
      Effect.gen(function* () {
        const repository = yield* TranscriptRepositoryService;
        return yield* repository.list();
      }).pipe(Effect.provide(fakeLayer)),
    );

    expect(results[0]?.id).toBe("fake");
  });
});
