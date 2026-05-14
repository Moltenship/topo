import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { Effect } from "effect";
import type { InstalledRuntimeRecord } from "@topo/shared";
import { installedRuntimes } from "./schema";

export interface InstalledRuntimeRepository {
  readonly list: () => Effect.Effect<readonly InstalledRuntimeRecord[]>;
  readonly getByRuntimeId: (runtimeId: string) => Effect.Effect<InstalledRuntimeRecord | null>;
  readonly upsert: (record: InstalledRuntimeRecord) => Effect.Effect<InstalledRuntimeRecord>;
  readonly removeByRuntimeId: (runtimeId: string) => Effect.Effect<void>;
}

export const createInstalledRuntimeRepository = (
  db: BetterSQLite3Database<Record<string, unknown>>,
): InstalledRuntimeRepository => ({
  list: () =>
    Effect.sync(() => {
      return db.select().from(installedRuntimes).all() as readonly InstalledRuntimeRecord[];
    }),
  getByRuntimeId: (runtimeId) =>
    Effect.sync(() => {
      const row = db
        .select()
        .from(installedRuntimes)
        .where(eq(installedRuntimes.runtimeId, runtimeId))
        .get();

      return row ? (row as InstalledRuntimeRecord) : null;
    }),
  upsert: (record) =>
    Effect.sync(() => {
      db.insert(installedRuntimes)
        .values(record)
        .onConflictDoUpdate({
          target: installedRuntimes.id,
          set: record,
        })
        .run();

      return record;
    }),
  removeByRuntimeId: (runtimeId) =>
    Effect.sync(() => {
      db.delete(installedRuntimes).where(eq(installedRuntimes.runtimeId, runtimeId)).run();
    }),
});
