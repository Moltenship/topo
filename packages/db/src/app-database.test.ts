import Database from "better-sqlite3";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Effect } from "effect";
import { afterEach, describe, expect, it } from "vitest";
import { openAppDatabase } from "./app-database";

const temporaryDirectories: string[] = [];

const makeTemporaryDirectory = () => {
  const directory = mkdtempSync(join(tmpdir(), "topo-db-"));
  temporaryDirectories.push(directory);

  return directory;
};

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("openAppDatabase", () => {
  it("creates a local sqlite database and stores transcript history", async () => {
    const directory = makeTemporaryDirectory();
    const database = await Effect.runPromise(openAppDatabase(directory));

    await Effect.runPromise(
      database.transcripts.insert({
        id: "transcript_1",
        text: "persistent local transcript",
        createdAt: "2026-05-08T00:00:00.000Z",
        durationMs: 1200,
        modelId: "whisper-cpp-small",
        runtime: "whisper-cpp",
        language: "en",
        recordingMode: "push-to-talk",
        stopReason: "hotkey-release",
        insertionMode: "paste",
        insertionStatus: "skipped",
        targetAppName: null,
        audioFileName: "transcript_1.wav",
        audioMimeType: "audio/wav",
        audioByteSize: 45,
      }),
    );

    const transcripts = await Effect.runPromise(database.transcripts.list("persistent"));
    await Effect.runPromise(database.close());

    expect(existsSync(database.path)).toBe(true);
    expect(transcripts).toHaveLength(1);
    expect(transcripts[0]?.text).toBe("persistent local transcript");
    expect(transcripts[0]?.audioFileName).toBe("transcript_1.wav");
  });

  it("persists installed model records", async () => {
    const directory = makeTemporaryDirectory();
    const database = await Effect.runPromise(openAppDatabase(directory));

    await Effect.runPromise(
      database.installedModels.upsert({
        id: "installed_whisper_cpp_small",
        modelId: "whisper-cpp-small",
        runtime: "whisper-cpp",
        sourceType: "huggingface-file",
        sourceRevision: "main",
        installedPath: "C:/models/whisper-cpp-small/ggml-small.bin",
        checksumSha256: "sha",
        verificationStatus: "verified",
        installedAt: "2026-05-09T00:00:00.000Z",
      }),
    );

    const installedModels = await Effect.runPromise(database.installedModels.list());
    await Effect.runPromise(database.close());

    expect(installedModels).toHaveLength(1);
    expect(installedModels[0]?.modelId).toBe("whisper-cpp-small");
  });

  it("persists installed runtime records", async () => {
    const directory = makeTemporaryDirectory();
    const database = await Effect.runPromise(openAppDatabase(directory));

    await Effect.runPromise(
      database.installedRuntimes.upsert({
        id: "installed_whisper_cpp_windows_x64",
        runtimeId: "whisper-cpp-windows-x64-cpu",
        engine: "whisper-cpp",
        installedPath: "C:/runtimes/whisper-cpp-windows-x64-cpu",
        binaryPath: "C:/runtimes/whisper-cpp-windows-x64-cpu/whisper-cli.exe",
        checksumSha256: "sha",
        verificationStatus: "verified",
        installedAt: "2026-05-14T00:00:00.000Z",
        lastProbedAt: "2026-05-14T00:01:00.000Z",
        lastProbeMessage: "ok",
      }),
    );

    const installedRuntimes = await Effect.runPromise(database.installedRuntimes.list());
    await Effect.runPromise(database.close());

    expect(installedRuntimes).toHaveLength(1);
    expect(installedRuntimes[0]?.runtimeId).toBe("whisper-cpp-windows-x64-cpu");
  });

  it("records applied migrations and can reopen the database idempotently", async () => {
    const directory = makeTemporaryDirectory();
    const firstDatabase = await Effect.runPromise(openAppDatabase(directory));
    await Effect.runPromise(firstDatabase.close());

    const secondDatabase = await Effect.runPromise(openAppDatabase(directory));
    await Effect.runPromise(secondDatabase.close());

    const sqlite = new Database(secondDatabase.path, { readonly: true });
    const migrations = sqlite.prepare("SELECT id FROM _topo_migrations ORDER BY id").all();
    sqlite.close();

    expect(migrations).toEqual([
      { id: "0001_initial_schema" },
      { id: "0002_expand_installed_models" },
      { id: "0003_installed_runtimes" },
      { id: "0004_transcript_audio_metadata" },
    ]);
  });

  it("migrates transcript audio metadata columns", async () => {
    const directory = makeTemporaryDirectory();
    const database = await Effect.runPromise(openAppDatabase(directory));
    await Effect.runPromise(database.close());

    const sqlite = new Database(database.path, { readonly: true });
    const columns = sqlite.prepare("PRAGMA table_info(transcripts)").all();
    sqlite.close();

    expect(columns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "audio_file_name" }),
        expect.objectContaining({ name: "audio_mime_type" }),
        expect.objectContaining({ name: "audio_byte_size" }),
      ]),
    );
  });
});
