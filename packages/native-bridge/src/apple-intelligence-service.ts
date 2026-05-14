import { Effect } from "effect";

export type AppleIntelligenceAvailabilityStatus =
  | "available"
  | "device-not-eligible"
  | "apple-intelligence-disabled"
  | "model-not-ready"
  | "unknown";

export interface AppleIntelligenceAvailability {
  readonly status: AppleIntelligenceAvailabilityStatus;
  readonly reason: string;
}

export type NativePermissionStatus = "granted" | "denied" | "not-determined" | "unknown";

export interface MacosPermissionReadiness {
  readonly accessibility: NativePermissionStatus;
  readonly inputMonitoring: NativePermissionStatus;
}

export interface AppleIntelligenceTextRequest {
  readonly systemPrompt?: string;
  readonly prompt: string;
  readonly maxTokens?: number;
}

export interface AppleIntelligenceService {
  readonly getAvailability: () => Effect.Effect<AppleIntelligenceAvailability, Error>;
  readonly getPermissionReadiness: () => Effect.Effect<MacosPermissionReadiness, Error>;
  readonly generateAppleIntelligenceText: (
    request: AppleIntelligenceTextRequest,
  ) => Effect.Effect<string, Error>;
}

export const createUnavailableAppleIntelligenceService = (
  availability: AppleIntelligenceAvailability = {
    status: "device-not-eligible",
    reason: "Apple Intelligence is only available on supported macOS devices.",
  },
): AppleIntelligenceService => ({
  getAvailability: () => Effect.succeed(availability),
  getPermissionReadiness: () =>
    Effect.succeed({
      accessibility: "unknown",
      inputMonitoring: "unknown",
    }),
  generateAppleIntelligenceText: () => Effect.fail(new Error(availability.reason)),
});

export const createMockAppleIntelligenceService = ({
  availability = { status: "available", reason: "Available." },
  permissions = { accessibility: "granted", inputMonitoring: "granted" },
  generate = (request: AppleIntelligenceTextRequest) => `processed:${request.prompt}`,
}: {
  readonly availability?: AppleIntelligenceAvailability;
  readonly permissions?: MacosPermissionReadiness;
  readonly generate?: (request: AppleIntelligenceTextRequest) => string;
} = {}): AppleIntelligenceService => ({
  getAvailability: () => Effect.succeed(availability),
  getPermissionReadiness: () => Effect.succeed(permissions),
  generateAppleIntelligenceText: (request) =>
    availability.status === "available"
      ? Effect.succeed(generate(request))
      : Effect.fail(new Error(availability.reason)),
});
