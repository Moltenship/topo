import { app, screen } from "electron";
import type { BrowserWindow } from "electron";
import { join } from "node:path";
import { Effect } from "effect";
import {
  appleIntelligence,
  createAiSdkPostProcessingProvider,
  createDictationOrchestrator,
  createWhisperCppTranscriptionProvider,
} from "@topo/asr";
import { createSubmittedAudioCaptureService } from "@topo/audio";
import { openAppDatabase } from "@topo/db";
import { getBundledModelCatalog } from "@topo/model-catalog";
import type { AppStateSnapshot } from "@topo/shared";
import { registerIpcHandlers } from "./ipc-handlers";
import { createAppleIntelligenceBridge } from "./apple-intelligence-bridge";
import { createMacosAppleIntelligenceService } from "./macos-apple-intelligence";
import { createElectronHotkeyBridge } from "./electron-hotkey-bridge";
import { createFileModelInstallJob } from "./model-install-job";
import { createFileRuntimeInstallJob } from "./runtime-install-job";
import {
  getNearestOverlayPosition,
  getOverlayWindowBounds,
  OVERLAY_WINDOW_SIZE,
} from "./overlay-position";
import { createWhisperCppRuntimeResolver } from "./whisper-cpp-runtime";
import { createMainWindow, createOverlayWindow } from "./window-manager";

const syncOverlayWindow = (window: BrowserWindow, snapshot: AppStateSnapshot) => {
  if (snapshot.overlayState === "hidden") {
    window.hide();
    return;
  }

  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());

  if (snapshot.overlayState === "preview") {
    window.setBounds(display.workArea);

    if (!window.isVisible()) {
      window.showInactive();
    }

    return;
  }

  window.setBounds(
    getOverlayWindowBounds({
      position: snapshot.settings.overlayPosition,
      workArea: display.workArea,
      windowSize: OVERLAY_WINDOW_SIZE,
    }),
  );

  if (!window.isVisible()) {
    window.showInactive();
  }
};

app.whenReady().then(() => {
  const userDataDirectory = app.getPath("userData");
  const catalog = getBundledModelCatalog({ includeDev: !app.isPackaged });
  const database = Effect.runSync(openAppDatabase(userDataDirectory));
  const audio = createSubmittedAudioCaptureService();
  const appleIntelligenceBridge = createAppleIntelligenceBridge();
  const appleIntelligenceService = createMacosAppleIntelligenceService({
    bridge: {
      getAvailability: appleIntelligenceBridge.getAvailability,
      generate: appleIntelligenceBridge.bridge.generate,
    },
  });
  const dictation = createDictationOrchestrator({
    audio,
    transcription: createWhisperCppTranscriptionProvider(),
    postProcessing: createAiSdkPostProcessingProvider({
      model: (modelId) =>
        appleIntelligence(modelId, {
          generate: (request) =>
            Effect.runPromise(
              appleIntelligenceService.generateAppleIntelligenceText({
                prompt: request.prompt,
                maxTokens: 512,
              }),
            ),
        }),
    }),
    now: () => new Date(),
    createId: () => crypto.randomUUID(),
  });

  createMainWindow();
  const overlayWindow = createOverlayWindow();

  const nativeBridge = createElectronHotkeyBridge();

  registerIpcHandlers({
    database,
    dictation,
    audio,
    catalog,
    modelInstallJob: createFileModelInstallJob({
      installRoot: join(userDataDirectory, "models"),
      resourcesRoot: join(app.getAppPath(), "resources"),
      catalog,
      fetch,
    }),
    runtimeInstallJob: createFileRuntimeInstallJob({
      installRoot: join(userDataDirectory, "runtimes"),
      repository: database.installedRuntimes,
      fetch,
    }),
    appleIntelligence: appleIntelligenceService,
    nativeBridge,
    createWhisperCppRuntimeResolver: (installedBinaryPath) =>
      createWhisperCppRuntimeResolver({
        resourcesRoot: join(app.getAppPath(), "resources"),
        installedBinaryPath,
      }),
    resolveOverlayPositionFromPreviewPoint: (point) => {
      const windowBounds = overlayWindow.getBounds();
      const center = {
        x: windowBounds.x + point.centerX,
        y: windowBounds.y + point.centerY,
      };
      const display = screen.getDisplayNearestPoint(center);

      return getNearestOverlayPosition({ center, workArea: display.workArea });
    },
    onAppStateChanged: (snapshot) => syncOverlayWindow(overlayWindow, snapshot),
  });
});
