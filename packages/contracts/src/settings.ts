import * as Schema from "effect/Schema";
import { InsertionMode, LanguageCode, RecordingMode } from "./dictation";
import { ApiPostProcessingSettings, PostProcessingMode } from "./post-processing";

export const SilenceTimeoutMs = Schema.Literal(1200, 1500, 2000, 3000);
export type SilenceTimeoutMs = typeof SilenceTimeoutMs.Type;

export const OverlayPosition = Schema.Literal(
  "bottom-center",
  "top-center",
  "bottom-left",
  "bottom-right",
  "center-left",
  "center-right",
);
export type OverlayPosition = typeof OverlayPosition.Type;

export const AppSettings = Schema.Struct({
  hotkey: Schema.optionalWith(Schema.String, { default: () => "CapsLock" }),
  recordingMode: Schema.optionalWith(RecordingMode, { default: () => "toggle-to-talk" }),
  silenceTimeoutMs: Schema.optionalWith(Schema.NullOr(SilenceTimeoutMs), { default: () => null }),
  insertionMode: Schema.optionalWith(InsertionMode, { default: () => "paste" }),
  postProcessingMode: Schema.optionalWith(PostProcessingMode, { default: () => "lightweight" }),
  postProcessingApiProvider: Schema.optionalWith(Schema.NullOr(ApiPostProcessingSettings), {
    default: () => null,
  }),
  language: Schema.optionalWith(LanguageCode, { default: () => "auto" }),
  historyEnabled: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  autoDeleteHistoryDays: Schema.optionalWith(Schema.NullOr(Schema.Int.pipe(Schema.positive())), {
    default: () => null,
  }),
  modelDirectory: Schema.optionalWith(Schema.NullOr(Schema.String), { default: () => null }),
  activeModelId: Schema.optionalWith(Schema.NullOr(Schema.String), { default: () => null }),
  microphoneDeviceId: Schema.optionalWith(Schema.NullOr(Schema.String), { default: () => null }),
  overlayPosition: Schema.optionalWith(OverlayPosition, { default: () => "bottom-center" }),
});
export type AppSettings = typeof AppSettings.Type;

export const DEFAULT_APP_SETTINGS: AppSettings = Schema.decodeUnknownSync(AppSettings)({});
