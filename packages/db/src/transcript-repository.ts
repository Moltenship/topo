import { desc, eq, like, lt } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { Effect } from "effect";
import type { TranscriptRecord } from "@topo/shared";
import { transcripts } from "./schema";

const normalizeTranscriptRecord = (row: typeof transcripts.$inferSelect): TranscriptRecord => ({
  id: row.id,
  text: row.text,
  createdAt: row.createdAt,
  durationMs: row.durationMs,
  modelId: row.modelId,
  runtime: row.runtime,
  language: row.language as TranscriptRecord["language"],
  recordingMode: row.recordingMode as TranscriptRecord["recordingMode"],
  stopReason: row.stopReason as TranscriptRecord["stopReason"],
  insertionMode: row.insertionMode as TranscriptRecord["insertionMode"],
  insertionStatus: row.insertionStatus as TranscriptRecord["insertionStatus"],
  targetAppName: row.targetAppName,
  audioFileName: null,
  audioMimeType: null,
  audioByteSize: null,
});

const assertNoAudioMetadata = (record: TranscriptRecord) => {
  if (
    record.audioFileName !== null ||
    record.audioMimeType !== null ||
    record.audioByteSize !== null
  ) {
    throw new Error("Transcript audio metadata cannot be stored before audio columns exist.");
  }
};

export interface TranscriptRepository {
  readonly insert: (record: TranscriptRecord) => Effect.Effect<void>;
  readonly getById: (id: string) => Effect.Effect<TranscriptRecord | null>;
  readonly list: (query?: string) => Effect.Effect<readonly TranscriptRecord[]>;
  readonly deleteById: (id: string) => Effect.Effect<void>;
  readonly deleteCreatedBefore: (cutoffIso: string) => Effect.Effect<void>;
  readonly clear: () => Effect.Effect<void>;
}

export const createTranscriptRepository = (
  db: BetterSQLite3Database<Record<string, unknown>>,
): TranscriptRepository => ({
  insert: (record) =>
    Effect.sync(() => {
      assertNoAudioMetadata(record);
      db.insert(transcripts).values(record).run();
    }),
  getById: (id) =>
    Effect.sync(() => {
      const row = db.select().from(transcripts).where(eq(transcripts.id, id)).get();

      return row ? normalizeTranscriptRecord(row) : null;
    }),
  list: (query) =>
    Effect.sync(() => {
      const rows = query
        ? db
            .select()
            .from(transcripts)
            .where(like(transcripts.text, `%${query}%`))
            .orderBy(desc(transcripts.createdAt))
            .all()
        : db.select().from(transcripts).orderBy(desc(transcripts.createdAt)).all();

      return rows.map(normalizeTranscriptRecord);
    }),
  deleteById: (id) =>
    Effect.sync(() => {
      db.delete(transcripts).where(eq(transcripts.id, id)).run();
    }),
  deleteCreatedBefore: (cutoffIso) =>
    Effect.sync(() => {
      db.delete(transcripts).where(lt(transcripts.createdAt, cutoffIso)).run();
    }),
  clear: () =>
    Effect.sync(() => {
      db.delete(transcripts).run();
    }),
});
