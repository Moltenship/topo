import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { bundledModelCatalog } from "./model-catalog";
import { createModelInstallPlan } from "./model-installation";
import { createMockModelInstallerService } from "./model-installer-service";

describe("createMockModelInstallerService", () => {
  it("returns a verified downloaded file for the install plan", async () => {
    const model = bundledModelCatalog[0];

    if (!model) {
      throw new Error("Expected bundled model catalog entry");
    }

    const plan = createModelInstallPlan(model, "/models");
    const installer = createMockModelInstallerService();

    await expect(Effect.runPromise(installer.install(plan))).resolves.toEqual({
      path: "/models/whisperkit-small/whisperkit-small.bin",
      sizeBytes: model.downloadSizeBytes,
      checksumSha256: model.checksumSha256,
    });
  });
});
