import { desc, eq, like } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { TranscriptRecord } from "@molten-voice/shared";
import { transcripts } from "./schema";

export interface TranscriptRepository {
  readonly insert: (record: TranscriptRecord) => Promise<void>;
  readonly list: (query?: string) => Promise<readonly TranscriptRecord[]>;
  readonly deleteById: (id: string) => Promise<void>;
  readonly clear: () => Promise<void>;
}

export const createTranscriptRepository = (
  db: BetterSQLite3Database<Record<string, unknown>>,
): TranscriptRepository => ({
  insert: async (record) => {
    db.insert(transcripts).values(record).run();
  },
  list: async (query) => {
    const rows = query
      ? db
          .select()
          .from(transcripts)
          .where(like(transcripts.text, `%${query}%`))
          .orderBy(desc(transcripts.createdAt))
          .all()
      : db.select().from(transcripts).orderBy(desc(transcripts.createdAt)).all();

    return rows as readonly TranscriptRecord[];
  },
  deleteById: async (id) => {
    db.delete(transcripts).where(eq(transcripts.id, id)).run();
  },
  clear: async () => {
    db.delete(transcripts).run();
  },
});
