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

  it("represents Windows whisper.cpp CPU as an official downloadable runtime pack", () => {
    const runtime = findCatalogRuntime("whisper-cpp-windows-x64-cpu");

    expect(runtime?.engine).toBe("whisper-cpp");
    expect(runtime?.platform).toBe("windows");
    expect(runtime?.architecture).toBe("x64");
    expect(runtime?.accelerator).toBe("cpu");
    expect(runtime?.source.type).not.toBe("system");
    expect(runtime?.source.type === "direct-url" ? runtime.source.url : "").toContain(
      "github.com/ggml-org/whisper.cpp/releases/download/v1.8.4/whisper-bin-x64.zip",
    );
    expect(runtime?.checksumSha256).toBe(
      "74f973345cb52ef5ba3ec9e7e7af8e48cc8c71722d1528603b80588a11f82e3e",
    );
    expect(runtime?.binaryRelativePath).toBe("whisper-cli.exe");
  });

  it("represents Windows whisper.cpp CUDA as an official NVIDIA GPU runtime pack", () => {
    const runtime = findCatalogRuntime("whisper-cpp-windows-x64-cuda");

    expect(runtime?.engine).toBe("whisper-cpp");
    expect(runtime?.platform).toBe("windows");
    expect(runtime?.architecture).toBe("x64");
    expect(runtime?.accelerator).toBe("cuda");
    expect(runtime?.source.type).not.toBe("system");
    expect(runtime?.source.type === "direct-url" ? runtime.source.url : "").toContain(
      "github.com/ggml-org/whisper.cpp/releases/download/v1.8.4/whisper-cublas-12.4.0-bin-x64.zip",
    );
    expect(runtime?.checksumSha256).toBe(
      "b07cff4e59831b227896018facbb6334907bf324a342c84597c44f087823d252",
    );
    expect(runtime?.binaryRelativePath).toBe("whisper-cli.exe");
  });

  it("has unique runtime ids", () => {
    const ids = bundledRuntimeCatalog.map((runtime) => runtime.id);

    expect(new Set(ids).size).toBe(ids.length);
  });
});
