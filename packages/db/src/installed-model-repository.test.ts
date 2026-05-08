import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { createInstalledModelRepository } from "./installed-model-repository";
import { installedModels } from "./schema";

const createRepository = () => {
  const sqlite = new Database(":memory:");

  sqlite.exec(`
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
  `);

  return createInstalledModelRepository(drizzle(sqlite, { schema: { installedModels } }));
};

describe("createInstalledModelRepository", () => {
  it("upserts, lists, reads, and removes installed models", async () => {
    const repository = createRepository();
    const record = {
      id: "installed_whisper_cpp_small",
      modelId: "whisper-cpp-small",
      runtime: "whisper-cpp",
      sourceType: "huggingface-file",
      sourceRevision: "main",
      installedPath: "C:/models/whisper-cpp-small/ggml-small.bin",
      checksumSha256: "sha",
      verificationStatus: "verified" as const,
      installedAt: "2026-05-09T00:00:00.000Z",
    };

    await Effect.runPromise(repository.upsert(record));

    expect(await Effect.runPromise(repository.list())).toEqual([record]);
    expect(await Effect.runPromise(repository.getByModelId("whisper-cpp-small"))).toEqual(record);

    await Effect.runPromise(repository.removeByModelId("whisper-cpp-small"));

    expect(await Effect.runPromise(repository.getByModelId("whisper-cpp-small"))).toBeNull();
  });
});
