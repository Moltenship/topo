import * as Schema from "effect/Schema";
import { OverlayState, TranscriptRecord } from "./dictation";
import { InstalledModelRecord, ModelReadinessRecord } from "./installed-model";
import { ModelInstallProgress } from "./model-installation";
import { AppSettings } from "./settings";

export const IpcChannels = {
  getAppState: "app:get-state",
  listTranscripts: "history:list-transcripts",
  copyTranscript: "history:copy-transcript",
  reinsertTranscript: "history:reinsert-transcript",
  deleteTranscript: "history:delete-transcript",
  clearTranscripts: "history:clear-transcripts",
  updateSettings: "settings:update",
  startTestDictation: "dictation:start-test",
  stopTestDictation: "dictation:stop-test",
  installModel: "models:install",
  cancelModelInstall: "models:cancel-install",
  windowMinimize: "window:minimize",
  windowMaximize: "window:maximize",
  windowClose: "window:close",
  appStateChanged: "app:state-changed",
} as const;

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels];

export const AppStateSnapshot = Schema.Struct({
  setupComplete: Schema.Boolean,
  overlayState: OverlayState,
  settings: AppSettings,
  transcripts: Schema.Array(TranscriptRecord),
  installedModels: Schema.Array(InstalledModelRecord),
  modelReadiness: Schema.Array(ModelReadinessRecord),
  modelInstallProgress: Schema.NullOr(ModelInstallProgress),
  errorMessage: Schema.NullOr(Schema.String),
});
export type AppStateSnapshot = typeof AppStateSnapshot.Type;

export const ListTranscriptsRequest = Schema.Struct({
  query: Schema.optional(Schema.String),
});
export type ListTranscriptsRequest = typeof ListTranscriptsRequest.Type;

export const DeleteTranscriptRequest = Schema.Struct({
  id: Schema.String,
});
export type DeleteTranscriptRequest = typeof DeleteTranscriptRequest.Type;

export const CopyTranscriptRequest = DeleteTranscriptRequest;
export type CopyTranscriptRequest = typeof CopyTranscriptRequest.Type;

export const ReinsertTranscriptRequest = DeleteTranscriptRequest;
export type ReinsertTranscriptRequest = typeof ReinsertTranscriptRequest.Type;

export const UpdateSettingsRequest = AppSettings;
export type UpdateSettingsRequest = typeof UpdateSettingsRequest.Type;

export const InstallModelRequest = Schema.Struct({
  modelId: Schema.String,
});
export type InstallModelRequest = typeof InstallModelRequest.Type;

export const CancelModelInstallRequest = Schema.Struct({
  modelId: Schema.String,
});
export type CancelModelInstallRequest = typeof CancelModelInstallRequest.Type;
