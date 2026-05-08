import * as Schema from "effect/Schema";
import { OverlayState, TranscriptRecord } from "./dictation";
import { AppSettings } from "./settings";

export const IpcChannels = {
  getAppState: "app:get-state",
  listTranscripts: "history:list-transcripts",
  deleteTranscript: "history:delete-transcript",
  clearTranscripts: "history:clear-transcripts",
  updateSettings: "settings:update",
  startTestDictation: "dictation:start-test",
  stopTestDictation: "dictation:stop-test",
  appStateChanged: "app:state-changed",
} as const;

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels];

export const AppStateSnapshot = Schema.Struct({
  setupComplete: Schema.Boolean,
  overlayState: OverlayState,
  settings: AppSettings,
  transcripts: Schema.Array(TranscriptRecord),
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

export const UpdateSettingsRequest = AppSettings;
export type UpdateSettingsRequest = typeof UpdateSettingsRequest.Type;
