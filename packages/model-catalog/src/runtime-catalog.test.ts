import { describe, expect, it } from "vitest";
import { bundledRuntimeCatalog, findCatalogRuntime } from "./runtime-catalog";

describe("bundledRuntimeCatalog", () => {
  it("represents macOS WhisperKit as a system runtime", () => {
    const runtime = findCatalogRuntime("whisperkit");

    expect(runtime?.engine).toBe("whisperkit");
    expect(runtime?.platform).toBe("macos");
    expect(runtime?.architecture).toBe("arm64");
    expect(runtime?.source.type).toBe("system");
    expect(runtime?.binaryRelativePath).toBeNull();
  });

  it("represents Windows whisper.cpp as a downloadable runtime pack", () => {
    const runtime = findCatalogRuntime("whisper-cpp-windows-x64");

    expect(runtime?.engine).toBe("whisper-cpp");
    expect(runtime?.platform).toBe("windows");
    expect(runtime?.architecture).toBe("x64");
    expect(runtime?.source.type).not.toBe("system");
    expect(runtime?.binaryRelativePath).toBe("whisper-cli.exe");
  });

  it("has unique runtime ids", () => {
    const ids = bundledRuntimeCatalog.map((runtime) => runtime.id);

    expect(new Set(ids).size).toBe(ids.length);
  });
});
