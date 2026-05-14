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

export const InstallBundleStage = Schema.Literal(
  "runtime",
  "model",
  "readiness",
  "installed",
  "failed",
  "canceled",
);
export type InstallBundleStage = typeof InstallBundleStage.Type;

export const InstallBundleProgress = Schema.Struct({
  modelId: Schema.String,
  runtimeId: Schema.NullOr(Schema.String),
  stage: InstallBundleStage,
  runtimeProgress: Schema.NullOr(ModelInstallProgress),
  modelProgress: Schema.NullOr(ModelInstallProgress),
  errorMessage: Schema.NullOr(Schema.String),
});
export type InstallBundleProgress = typeof InstallBundleProgress.Type;
