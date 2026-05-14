import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { Effect } from "effect";
import type { InstalledModelRecord } from "@topo/shared";
import { installedModels } from "./schema";

export interface InstalledModelRepository {
  readonly list: () => Effect.Effect<readonly InstalledModelRecord[]>;
  readonly getByModelId: (modelId: string) => Effect.Effect<InstalledModelRecord | null>;
  readonly upsert: (record: InstalledModelRecord) => Effect.Effect<InstalledModelRecord>;
  readonly removeByModelId: (modelId: string) => Effect.Effect<void>;
}

export const createInstalledModelRepository = (
  db: BetterSQLite3Database<Record<string, unknown>>,
): InstalledModelRepository => ({
  list: () =>
    Effect.sync(() => {
      return db.select().from(installedModels).all() as readonly InstalledModelRecord[];
    }),
  getByModelId: (modelId) =>
    Effect.sync(() => {
      const row = db
        .select()
        .from(installedModels)
        .where(eq(installedModels.modelId, modelId))
        .get();

      return row ? (row as InstalledModelRecord) : null;
    }),
  upsert: (record) =>
    Effect.sync(() => {
      db.insert(installedModels)
        .values(record)
        .onConflictDoUpdate({
          target: installedModels.id,
          set: record,
        })
        .run();

      return record;
    }),
  removeByModelId: (modelId) =>
    Effect.sync(() => {
      db.delete(installedModels).where(eq(installedModels.modelId, modelId)).run();
    }),
});
