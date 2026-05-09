import * as Schema from "effect/Schema";

export const ModelInstallStatus = Schema.Literal(
  "not-installed",
  "queued",
  "resolving",
  "downloading",
  "verifying",
  "installing",
  "installed",
  "canceled",
  "failed",
);
export type ModelInstallStatus = typeof ModelInstallStatus.Type;

export const ModelInstallProgress = Schema.Struct({
  modelId: Schema.String,
  status: ModelInstallStatus,
  receivedBytes: Schema.Number,
  totalBytes: Schema.Number,
  percent: Schema.Number,
  errorMessage: Schema.NullOr(Schema.String),
});
export type ModelInstallProgress = typeof ModelInstallProgress.Type;
