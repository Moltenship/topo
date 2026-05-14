import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { InstalledRuntimeRecord } from "./installed-runtime";

describe("InstalledRuntimeRecord", () => {
  it("decodes a verified system WhisperKit runtime record", () => {
    const decoded = Schema.decodeUnknownSync(InstalledRuntimeRecord)({
      id: "runtime-whisperkit",
      runtimeId: "whisperkit",
      engine: "whisperkit",
      installedPath: "/System/Library/Frameworks",
      binaryPath: null,
      checksumSha256: null,
      verificationStatus: "verified",
      installedAt: "2026-05-14T00:00:00.000Z",
      lastProbedAt: null,
      lastProbeMessage: null,
    });

    expect(decoded.runtimeId).toBe("whisperkit");
    expect(decoded.binaryPath).toBeNull();
  });
});
