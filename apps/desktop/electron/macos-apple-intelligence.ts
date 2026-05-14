import { Effect } from "effect";
import type { AppleIntelligenceService, AppleIntelligenceTextRequest } from "@topo/native-bridge";
import type { AppleIntelligenceAvailability } from "@topo/shared";
import { getMacosPermissionReadiness } from "./macos-permissions";

export interface MacosAppleIntelligenceBridge {
  readonly getAvailability?: () => Effect.Effect<AppleIntelligenceAvailability, Error>;
  readonly generate: (request: AppleIntelligenceTextRequest) => Promise<string>;
}

export const createMacosAppleIntelligenceService = ({
  bridge,
  platform = process.platform,
}: {
  readonly bridge?: MacosAppleIntelligenceBridge;
  readonly platform?: NodeJS.Platform;
} = {}): AppleIntelligenceService => ({
  getAvailability: () => {
    const platformAvailability = getAvailability(toAvailabilityInput(platform, bridge));

    if (platformAvailability.status !== "available" || !bridge?.getAvailability) {
      return Effect.succeed(platformAvailability);
    }

    return bridge.getAvailability();
  },
  getPermissionReadiness: () => Effect.sync(getMacosPermissionReadiness),
  generateAppleIntelligenceText: (request) =>
    Effect.tryPromise({
      try: async () => {
        const availability = bridge?.getAvailability
          ? await Effect.runPromise(bridge.getAvailability())
          : getAvailability(toAvailabilityInput(platform, bridge));

        if (availability.status !== "available" || !bridge) {
          throw new Error(availability.reason);
        }

        return bridge.generate(request);
      },
      catch: (error) => (error instanceof Error ? error : new Error(String(error))),
    }),
});

const toAvailabilityInput = (
  platform: NodeJS.Platform,
  bridge: MacosAppleIntelligenceBridge | undefined,
) => (bridge ? { bridge, platform } : { platform });

const getAvailability = ({
  bridge,
  platform,
}: {
  readonly bridge?: MacosAppleIntelligenceBridge;
  readonly platform: NodeJS.Platform;
}): AppleIntelligenceAvailability => {
  if (platform !== "darwin") {
    return {
      status: "device-not-eligible",
      reason: "Apple Intelligence is only available on supported macOS devices.",
    };
  }

  if (!bridge) {
    return {
      status: "model-not-ready",
      reason: "The local Apple Intelligence bridge is not installed or ready.",
    };
  }

  return {
    status: "available",
    reason: "Apple Intelligence is available through the local macOS bridge.",
  };
};
