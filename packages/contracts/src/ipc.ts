import * as Schema from "effect/Schema";
import { OverlayState, TranscriptRecord } from "./dictation";
import { InstalledModelRecord, ModelReadinessRecord } from "./installed-model";
import { InstalledRuntimeRecord } from "./installed-runtime";
import { InstallBundleProgress, ModelInstallProgress } from "./model-installation";
import {
  AppleIntelligenceAvailability,
  TestPostProcessingRequest,
  TestPostProcessingResponse,
} from "./post-processing";
import { AppSettings } from "./settings";

export const IpcChannels = {
  getAppState: "app:get-state",
  listTranscripts: "history:list-transcripts",
  copyTranscript: "history:copy-transcript",
  reinsertTranscript: "history:reinsert-transcript",
  deleteTranscript: "history:delete-transcript",
  loadTranscriptAudio: "history:load-transcript-audio",
  clearTranscripts: "history:clear-transcripts",
  updateSettings: "settings:update",
  showOverlayPreview: "overlay:show-preview",
  commitOverlayPreviewPosition: "overlay:commit-preview-position",
  startTestDictation: "dictation:start-test",
  stopTestDictation: "dictation:stop-test",
  globalHotkeyEvent: "dictation:global-hotkey-event",
  installModel: "models:install",
  installModelBundle: "models:install-bundle",
  cancelModelInstall: "models:cancel-install",
  refreshModelReadiness: "models:refresh-readiness",
  getAppleIntelligenceAvailability: "post-processing:apple-intelligence-availability",
  testPostProcessing: "post-processing:test",
  openDiagnosticsFolder: "diagnostics:open-folder",
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
  installedRuntimes: Schema.Array(InstalledRuntimeRecord),
  modelReadiness: Schema.Array(ModelReadinessRecord),
  modelInstallProgress: Schema.NullOr(ModelInstallProgress),
  runtimeInstallProgress: Schema.NullOr(ModelInstallProgress),
  bundleInstallProgress: Schema.NullOr(InstallBundleProgress),
  diagnosticsLogDirectory: Schema.String,
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

export const LoadTranscriptAudioRequest = DeleteTranscriptRequest;
export type LoadTranscriptAudioRequest = typeof LoadTranscriptAudioRequest.Type;

export const LoadTranscriptAudioResponse = Schema.Struct({
  bytes: Schema.Uint8ArrayFromSelf,
  mimeType: Schema.String,
  byteSize: Schema.Number,
});
export type LoadTranscriptAudioResponse = typeof LoadTranscriptAudioResponse.Type;

export const UpdateSettingsRequest = AppSettings;
export type UpdateSettingsRequest = typeof UpdateSettingsRequest.Type;

export const InstallModelRequest = Schema.Struct({
  modelId: Schema.String,
});
export type InstallModelRequest = typeof InstallModelRequest.Type;

export const InstallModelBundleRequest = InstallModelRequest;
export type InstallModelBundleRequest = typeof InstallModelBundleRequest.Type;

export const CancelModelInstallRequest = Schema.Struct({
  modelId: Schema.String,
});
export type CancelModelInstallRequest = typeof CancelModelInstallRequest.Type;

export const CommitOverlayPreviewPositionRequest = Schema.Struct({
  centerX: Schema.Number,
  centerY: Schema.Number,
});
export type CommitOverlayPreviewPositionRequest = typeof CommitOverlayPreviewPositionRequest.Type;

export const AppleIntelligenceAvailabilityResponse = AppleIntelligenceAvailability;
export type AppleIntelligenceAvailabilityResponse =
  typeof AppleIntelligenceAvailabilityResponse.Type;

export { TestPostProcessingRequest, TestPostProcessingResponse };
