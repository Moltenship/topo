import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { Context, Layer } from "effect";
import { createTranscriptRepository, type TranscriptRepository } from "./transcript-repository";

export class TranscriptRepositoryService extends Context.Tag(
  "@topo/db/TranscriptRepositoryService",
)<TranscriptRepositoryService, TranscriptRepository>() {}

export const makeTranscriptRepositoryLayer = (
  db: BetterSQLite3Database<Record<string, unknown>>,
): Layer.Layer<TranscriptRepositoryService> =>
  Layer.succeed(TranscriptRepositoryService, createTranscriptRepository(db));
