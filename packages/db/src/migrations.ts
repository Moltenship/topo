import type Database from "better-sqlite3";
import { Effect } from "effect";

interface Migration {
  readonly id: string;
  readonly sql: string;
}

const migrations: readonly Migration[] = [
  {
    id: "0001_initial_schema",
    sql: `
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
    `,
  },
  {
    id: "0002_expand_installed_models",
    sql: `
      DROP TABLE IF EXISTS installed_models;

      CREATE TABLE installed_models (
        id TEXT PRIMARY KEY,
        model_id TEXT NOT NULL,
        runtime TEXT NOT NULL,
        source_type TEXT NOT NULL,
        source_revision TEXT NOT NULL,
        installed_path TEXT NOT NULL,
        checksum_sha256 TEXT NOT NULL,
        verification_status TEXT NOT NULL,
        installed_at TEXT NOT NULL
      );
    `,
  },
];

const createMigrationTable = (sqlite: Database.Database) => {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS _topo_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);
};

export const applyMigrations = (sqlite: Database.Database): Effect.Effect<readonly string[]> =>
  Effect.sync(() => {
    createMigrationTable(sqlite);

    const appliedMigrationIds = new Set(
      sqlite
        .prepare("SELECT id FROM _topo_migrations")
        .all()
        .map((row) => {
          return (row as { id: string }).id;
        }),
    );
    const appliedNow: string[] = [];

    const transaction = sqlite.transaction(() => {
      for (const migration of migrations) {
        if (appliedMigrationIds.has(migration.id)) {
          continue;
        }

        sqlite.exec(migration.sql);
        sqlite
          .prepare("INSERT INTO _topo_migrations (id, applied_at) VALUES (?, ?)")
          .run(migration.id, new Date().toISOString());
        appliedNow.push(migration.id);
      }
    });

    transaction();

    return appliedNow;
  });
