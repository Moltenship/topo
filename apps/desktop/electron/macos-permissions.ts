import { systemPreferences } from "electron";
import type { MacosPermissionReadiness, NativePermissionStatus } from "@topo/native-bridge";

interface MacosSystemPreferences {
  readonly isTrustedAccessibilityClient?: (prompt: boolean) => boolean;
}

export const getMacosPermissionReadiness = (): MacosPermissionReadiness => {
  if (process.platform !== "darwin") {
    return {
      accessibility: "unknown",
      inputMonitoring: "unknown",
    };
  }

  return {
    accessibility: getAccessibilityStatus(systemPreferences),
    inputMonitoring: "unknown",
  };
};

const getAccessibilityStatus = (preferences: MacosSystemPreferences): NativePermissionStatus => {
  if (!preferences.isTrustedAccessibilityClient) {
    return "unknown";
  }

  return preferences.isTrustedAccessibilityClient(false) ? "granted" : "denied";
};
