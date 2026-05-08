import { app } from "electron";
import { Effect } from "effect";
import { createDictationOrchestrator, createMockTranscriptionProvider } from "@molten-voice/asr";
import { createMockAudioCaptureService } from "@molten-voice/audio";
import { openAppDatabase } from "@molten-voice/db";
import { registerIpcHandlers } from "./ipc-handlers";
import { createMainWindow } from "./window-manager";

app.whenReady().then(() => {
  const database = Effect.runSync(openAppDatabase(app.getPath("userData")));
  const dictation = createDictationOrchestrator({
    audio: createMockAudioCaptureService(),
    transcription: createMockTranscriptionProvider(),
    now: () => new Date(),
    createId: () => crypto.randomUUID(),
  });

  registerIpcHandlers({ database, dictation });
  createMainWindow();
});
