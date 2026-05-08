import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { Effect } from "effect";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { applyMigrations } from "./migrations";
import { createSettingsRepository, type SettingsRepository } from "./settings-repository";
import { createTranscriptRepository, type TranscriptRepository } from "./transcript-repository";
import { settings, transcripts } from "./schema";

export interface AppDatabase {
  readonly path: string;
  readonly settings: SettingsRepository;
  readonly transcripts: TranscriptRepository;
  readonly close: () => Effect.Effect<void>;
}

export const openAppDatabase = (appDataDirectory: string): Effect.Effect<AppDatabase> =>
  Effect.gen(function* () {
    const path = join(appDataDirectory, "molten-voice.sqlite");

    mkdirSync(dirname(path), { recursive: true });

    const sqlite = new Database(path);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    yield* applyMigrations(sqlite);

    const db = drizzle(sqlite, { schema: { settings, transcripts } });

    return {
      path,
      settings: createSettingsRepository(db),
      transcripts: createTranscriptRepository(db),
      close: () =>
        Effect.sync(() => {
          sqlite.close();
        }),
    };
  });
