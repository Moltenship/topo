import { Effect } from "effect";
import type { DownloadedModelFile, ModelInstallPlan } from "./model-installation";
import { verifyDownloadedModel } from "./model-installation";

export interface ModelInstallerService {
  readonly install: (plan: ModelInstallPlan) => Effect.Effect<DownloadedModelFile, Error>;
}

export const createMockModelInstallerService = (): ModelInstallerService => ({
  install: (plan) =>
    Effect.gen(function* () {
      const downloadedFile = {
        path: plan.modelFilePath,
        sizeBytes: plan.expectedSizeBytes,
        checksumSha256: plan.expectedChecksumSha256,
      };
      const verification = verifyDownloadedModel(plan, downloadedFile);

      if (verification.status !== "installed") {
        return yield* Effect.fail(new Error(`Model verification failed: ${verification.reason}`));
      }

      return downloadedFile;
    }),
});
