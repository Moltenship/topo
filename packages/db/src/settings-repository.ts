import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { Effect } from "effect";
import { parseAppSettings } from "@topo/settings";
import type { AppSettings } from "@topo/shared";
import { settings } from "./schema";

const APP_SETTINGS_KEY = "app";

export interface SettingsRepository {
  readonly get: () => Effect.Effect<AppSettings | null>;
  readonly set: (value: AppSettings) => Effect.Effect<AppSettings>;
}

export const createSettingsRepository = (
  db: BetterSQLite3Database<Record<string, unknown>>,
): SettingsRepository => ({
  get: () =>
    Effect.sync(() => {
      const row = db.select().from(settings).where(eq(settings.key, APP_SETTINGS_KEY)).get();

      if (!row) {
        return null;
      }

      return parseAppSettings(JSON.parse(row.valueJson));
    }),
  set: (value) =>
    Effect.sync(() => {
      const now = new Date().toISOString();

      db.insert(settings)
        .values({
          key: APP_SETTINGS_KEY,
          valueJson: JSON.stringify(value),
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: settings.key,
          set: {
            valueJson: JSON.stringify(value),
            updatedAt: now,
          },
        })
        .run();

      return value;
    }),
});
