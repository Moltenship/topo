import { desc, eq, like, lt } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { Effect } from "effect";
import type { TranscriptRecord } from "@molten-voice/shared";
import { transcripts } from "./schema";

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
      db.insert(transcripts).values(record).run();
    }),
  getById: (id) =>
    Effect.sync(() => {
      const row = db.select().from(transcripts).where(eq(transcripts.id, id)).get();

      return (row as TranscriptRecord | undefined) ?? null;
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

      return rows as readonly TranscriptRecord[];
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
