import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  valueJson: text("value_json").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const installedModels = sqliteTable("installed_models", {
  id: text("id").primaryKey(),
  modelId: text("model_id").notNull(),
  runtime: text("runtime").notNull(),
  sourceType: text("source_type").notNull(),
  sourceRevision: text("source_revision").notNull(),
  installedPath: text("installed_path").notNull(),
  checksumSha256: text("checksum_sha256").notNull(),
  verificationStatus: text("verification_status").notNull(),
  installedAt: text("installed_at").notNull(),
});

export const installedRuntimes = sqliteTable("installed_runtimes", {
  id: text("id").primaryKey(),
  runtimeId: text("runtime_id").notNull(),
  engine: text("engine").notNull(),
  installedPath: text("installed_path").notNull(),
  binaryPath: text("binary_path"),
  checksumSha256: text("checksum_sha256"),
  verificationStatus: text("verification_status").notNull(),
  installedAt: text("installed_at").notNull(),
  lastProbedAt: text("last_probed_at"),
  lastProbeMessage: text("last_probe_message"),
});

export const transcripts = sqliteTable("transcripts", {
  id: text("id").primaryKey(),
  text: text("text").notNull(),
  createdAt: text("created_at").notNull(),
  durationMs: integer("duration_ms").notNull(),
  modelId: text("model_id").notNull(),
  runtime: text("runtime").notNull(),
  language: text("language").notNull(),
  recordingMode: text("recording_mode").notNull(),
  stopReason: text("stop_reason").notNull(),
  insertionMode: text("insertion_mode").notNull(),
  insertionStatus: text("insertion_status").notNull(),
  targetAppName: text("target_app_name"),
});

export const insertionEvents = sqliteTable("insertion_events", {
  id: text("id").primaryKey(),
  transcriptId: text("transcript_id").notNull(),
  mode: text("mode").notNull(),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
  errorCode: text("error_code"),
});
