import * as Schema from "effect/Schema";
import {
  AppSettings as AppSettingsContract,
  DEFAULT_APP_SETTINGS,
  InsertionMode,
  LanguageCode,
  PostProcessingMode,
  RecordingMode,
  SilenceTimeoutMs,
} from "@molten-voice/contracts";

export const recordingModeSchema = RecordingMode;
export const insertionModeSchema = InsertionMode;
export const postProcessingModeSchema = PostProcessingMode;
export const languageSchema = LanguageCode;
export const appSettingsSchema = AppSettingsContract;

export type AppSettings = typeof AppSettingsContract.Type;

export const defaultAppSettings = (): AppSettings => DEFAULT_APP_SETTINGS;

export const parseAppSettings = (input: unknown): AppSettings =>
  Schema.decodeUnknownSync(AppSettingsContract)(input);

export const parseSilenceTimeoutMs = (input: unknown): SilenceTimeoutMs =>
  Schema.decodeUnknownSync(SilenceTimeoutMs)(input);
