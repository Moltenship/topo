import * as Schema from "effect/Schema";

export const InstalledModelVerificationStatus = Schema.Literal("verified", "missing", "corrupt");
export type InstalledModelVerificationStatus = typeof InstalledModelVerificationStatus.Type;

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
