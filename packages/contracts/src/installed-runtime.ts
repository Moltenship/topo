import * as Schema from "effect/Schema";

export const RuntimeEngine = Schema.Literal("whisperkit", "whisper-cpp");
export type RuntimeEngine = typeof RuntimeEngine.Type;

export const RuntimeId = Schema.Literal(
  "whisperkit",
  "whisper-cpp-windows-x64-cpu",
  "whisper-cpp-windows-x64-cuda",
  "whisper-cpp-macos-arm64",
);
export type RuntimeId = typeof RuntimeId.Type;

export const InstalledRuntimeVerificationStatus = Schema.Literal("verified", "corrupt", "missing");
export type InstalledRuntimeVerificationStatus = typeof InstalledRuntimeVerificationStatus.Type;

export const InstalledRuntimeRecord = Schema.Struct({
  id: Schema.String,
  runtimeId: RuntimeId,
  engine: RuntimeEngine,
  installedPath: Schema.String,
  binaryPath: Schema.NullOr(Schema.String),
  checksumSha256: Schema.NullOr(Schema.String),
  verificationStatus: InstalledRuntimeVerificationStatus,
  installedAt: Schema.String,
  lastProbedAt: Schema.NullOr(Schema.String),
  lastProbeMessage: Schema.NullOr(Schema.String),
});
export type InstalledRuntimeRecord = typeof InstalledRuntimeRecord.Type;
