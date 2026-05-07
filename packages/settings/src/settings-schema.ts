import { z } from "zod";

export const recordingModeSchema = z.enum(["push-to-talk", "smart-dictation"]);
export const insertionModeSchema = z.enum(["paste", "typing", "hybrid"]);
export const postProcessingModeSchema = z.enum(["raw", "lightweight"]);
export const languageSchema = z.enum(["en", "ru", "auto"]);

export const appSettingsSchema = z.object({
  hotkey: z.string().min(1).default("CapsLock"),
  recordingMode: recordingModeSchema.default("push-to-talk"),
  silenceTimeoutMs: z
    .union([z.literal(1200), z.literal(1500), z.literal(2000), z.literal(3000)])
    .nullable()
    .default(null),
  insertionMode: insertionModeSchema.default("paste"),
  postProcessingMode: postProcessingModeSchema.default("lightweight"),
  language: languageSchema.default("auto"),
  historyEnabled: z.boolean().default(true),
  autoDeleteHistoryDays: z.number().int().positive().nullable().default(null),
  modelDirectory: z.string().nullable().default(null),
  activeModelId: z.string().nullable().default(null),
});

export type AppSettings = z.infer<typeof appSettingsSchema>;

export const defaultAppSettings = (): AppSettings => appSettingsSchema.parse({});
