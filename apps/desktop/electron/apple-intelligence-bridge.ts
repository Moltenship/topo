import type { AppleIntelligenceTextRequest } from "@topo/native-bridge";
import type { MacosAppleIntelligenceBridge } from "./macos-apple-intelligence";

export const createUnavailableAppleIntelligenceBridge = (): MacosAppleIntelligenceBridge => ({
  generate: async (_request: AppleIntelligenceTextRequest) => {
    throw new Error("Apple Intelligence Swift helper is not bundled yet.");
  },
});
