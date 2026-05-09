import * as Schema from "effect/Schema";

export const InstalledModelVerificationStatus = Schema.Literal("verified", "missing", "corrupt");
export type InstalledModelVerificationStatus = typeof InstalledModelVerificationStatus.Type;

export const ModelReadinessStatus = Schema.Literal(
  "not-installed",
  "runtime-missing",
  "runtime-failed",
  "ready",
);
export type ModelReadinessStatus = typeof ModelReadinessStatus.Type;

export const ModelReadinessLamp = Schema.Literal("none", "yellow", "red", "green");
export type ModelReadinessLamp = typeof ModelReadinessLamp.Type;

export const InstalledModelRecord = Schema.Struct({
  id: Schema.String,
  modelId: Schema.String,
  runtime: Schema.String,
  sourceType: Schema.String,
  sourceRevision: Schema.String,
  installedPath: Schema.String,
  checksumSha256: Schema.String,
  verificationStatus: InstalledModelVerificationStatus,
  installedAt: Schema.String,
});
export type InstalledModelRecord = typeof InstalledModelRecord.Type;

export const ModelReadinessRecord = Schema.Struct({
  modelId: Schema.String,
  status: ModelReadinessStatus,
  lamp: ModelReadinessLamp,
  message: Schema.String,
  runtimeBinaryPath: Schema.NullOr(Schema.String),
  checkedAt: Schema.String,
});
export type ModelReadinessRecord = typeof ModelReadinessRecord.Type;
