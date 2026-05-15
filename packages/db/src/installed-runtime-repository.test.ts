import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { createInstalledRuntimeRepository } from "./installed-runtime-repository";
import { installedRuntimes } from "./schema";

const createRepository = () => {
  const sqlite = new Database(":memory:");

  sqlite.exec(`
    CREATE TABLE installed_runtimes (
      id TEXT PRIMARY KEY,
      runtime_id TEXT NOT NULL,
      engine TEXT NOT NULL,
      installed_path TEXT NOT NULL,
      binary_path TEXT,
      checksum_sha256 TEXT,
      verification_status TEXT NOT NULL,
      installed_at TEXT NOT NULL,
      last_probed_at TEXT,
      last_probe_message TEXT
    );
  `);

  return createInstalledRuntimeRepository(drizzle(sqlite, { schema: { installedRuntimes } }));
};

describe("createInstalledRuntimeRepository", () => {
  it("upserts, lists, reads, and removes installed runtimes", async () => {
    const repository = createRepository();
    const record = {
      id: "installed_whisper_cpp_windows_x64",
      runtimeId: "whisper-cpp-windows-x64-cpu" as const,
      engine: "whisper-cpp" as const,
      installedPath: "C:/runtimes/whisper-cpp-windows-x64-cpu",
      binaryPath: "C:/runtimes/whisper-cpp-windows-x64-cpu/whisper-cli.exe",
      checksumSha256: "sha",
      verificationStatus: "verified" as const,
      installedAt: "2026-05-14T00:00:00.000Z",
      lastProbedAt: "2026-05-14T00:01:00.000Z",
      lastProbeMessage: "ok",
    };

    await Effect.runPromise(repository.upsert(record));

    expect(await Effect.runPromise(repository.list())).toEqual([record]);
    expect(
      await Effect.runPromise(repository.getByRuntimeId("whisper-cpp-windows-x64-cpu")),
    ).toEqual(record);

    await Effect.runPromise(repository.removeByRuntimeId("whisper-cpp-windows-x64-cpu"));

    expect(
      await Effect.runPromise(repository.getByRuntimeId("whisper-cpp-windows-x64-cpu")),
    ).toBeNull();
  });
});
