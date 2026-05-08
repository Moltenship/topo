import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { DEFAULT_APP_SETTINGS } from "@molten-voice/shared";
import { settings } from "./schema";
import { createSettingsRepository } from "./settings-repository";

const makeRepository = () => {
  const sqlite = new Database(":memory:");

  sqlite.exec(`
    CREATE TABLE settings (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  return createSettingsRepository(drizzle(sqlite, { schema: { settings } }));
};

describe("createSettingsRepository", () => {
  it("persists and validates app settings", async () => {
    const repository = makeRepository();
    const nextSettings = {
      ...DEFAULT_APP_SETTINGS,
      hotkey: "ShiftRight",
      activeModelId: "whisper-cpp-small",
    };

    const initial = await Effect.runPromise(repository.get());
    const saved = await Effect.runPromise(repository.set(nextSettings));
    const loaded = await Effect.runPromise(repository.get());

    expect(initial).toBeNull();
    expect(saved.activeModelId).toBe("whisper-cpp-small");
    expect(loaded).toMatchObject({
      hotkey: "ShiftRight",
      activeModelId: "whisper-cpp-small",
    });
  });
});
