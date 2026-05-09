import { app } from "electron";
import type { BrowserWindow } from "electron";
import { join } from "node:path";
import { Effect } from "effect";
import { createDictationOrchestrator, createMockTranscriptionProvider } from "@molten-voice/asr";
import { createMockAudioCaptureService } from "@molten-voice/audio";
import { openAppDatabase } from "@molten-voice/db";
import { getBundledModelCatalog } from "@molten-voice/model-catalog";
import { createMockNativeBridgeService } from "@molten-voice/native-bridge";
import type { AppStateSnapshot } from "@molten-voice/shared";
import { registerIpcHandlers } from "./ipc-handlers";
import { createFileModelInstallJob } from "./model-install-job";
import { createWhisperCppRuntimeResolver } from "./whisper-cpp-runtime";
import { createMainWindow, createOverlayWindow } from "./window-manager";

const syncOverlayWindow = (window: BrowserWindow, snapshot: AppStateSnapshot) => {
  if (snapshot.overlayState === "hidden") {
    window.hide();
    return;
  }

  if (!window.isVisible()) {
    window.showInactive();
  }
};

app.whenReady().then(() => {
  const userDataDirectory = app.getPath("userData");
  const catalog = getBundledModelCatalog({ includeDev: !app.isPackaged });
  const database = Effect.runSync(openAppDatabase(userDataDirectory));
  const dictation = createDictationOrchestrator({
    audio: createMockAudioCaptureService(),
    transcription: createMockTranscriptionProvider(),
    now: () => new Date(),
    createId: () => crypto.randomUUID(),
  });

  createMainWindow();
  const overlayWindow = createOverlayWindow();

  registerIpcHandlers({
    database,
    dictation,
    catalog,
    modelInstallJob: createFileModelInstallJob({
      installRoot: join(userDataDirectory, "models"),
      resourcesRoot: join(app.getAppPath(), "resources"),
      catalog,
      fetch,
    }),
    nativeBridge: createMockNativeBridgeService(),
    whisperCppRuntimeResolver: createWhisperCppRuntimeResolver({
      resourcesRoot: join(app.getAppPath(), "resources"),
    }),
    onAppStateChanged: (snapshot) => syncOverlayWindow(overlayWindow, snapshot),
  });
});
