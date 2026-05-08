import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { Effect } from "effect";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createTranscriptRepository, type TranscriptRepository } from "./transcript-repository";
import { transcripts } from "./schema";

export interface AppDatabase {
  readonly path: string;
  readonly transcripts: TranscriptRepository;
  readonly close: () => Effect.Effect<void>;
}

const createSchema = (sqlite: Database.Database) => {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS installed_models (
      id TEXT PRIMARY KEY,
      model_id TEXT NOT NULL,
      runtime TEXT NOT NULL,
      directory TEXT NOT NULL,
      checksum_sha256 TEXT NOT NULL,
      installed_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transcripts (
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
    );

    CREATE TABLE IF NOT EXISTS insertion_events (
      id TEXT PRIMARY KEY,
      transcript_id TEXT NOT NULL,
      mode TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      error_code TEXT
    );
  `);
};

export const openAppDatabase = (appDataDirectory: string): Effect.Effect<AppDatabase> =>
  Effect.sync(() => {
    const path = join(appDataDirectory, "molten-voice.sqlite");

    mkdirSync(dirname(path), { recursive: true });

    const sqlite = new Database(path);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    createSchema(sqlite);

    const db = drizzle(sqlite, { schema: { transcripts } });

    return {
      path,
      transcripts: createTranscriptRepository(db),
      close: () =>
        Effect.sync(() => {
          sqlite.close();
        }),
    };
  });
