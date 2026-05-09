import { describe, expect, it } from "vitest";
import { resolveDownloadSourceUrl } from "./download-source";

describe("resolveDownloadSourceUrl", () => {
  it("keeps direct download URLs unchanged", () => {
    expect(
      resolveDownloadSourceUrl({ type: "direct-url", url: "https://example.invalid/a.bin" }),
    ).toBe("https://example.invalid/a.bin");
  });

  it("builds a pinned GitHub release asset URL", () => {
    expect(
      resolveDownloadSourceUrl({
        type: "github-release",
        owner: "upstream-org",
        repo: "runtime-pack",
        tag: "v1.2.3",
        assetName: "runtime-windows-x64.zip",
      }),
    ).toBe(
      "https://github.com/upstream-org/runtime-pack/releases/download/v1.2.3/runtime-windows-x64.zip",
    );
  });

  it("builds a pinned Hugging Face file URL", () => {
    expect(
      resolveDownloadSourceUrl({
        type: "huggingface-file",
        repo: "ggerganov/whisper.cpp",
        revision: "main",
        filePath: "ggml-small.bin",
      }),
    ).toBe("https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin");
  });

  it("builds a pinned Hugging Face snapshot folder URL", () => {
    expect(
      resolveDownloadSourceUrl({
        type: "huggingface-snapshot",
        repo: "argmaxinc/whisperkit-coreml",
        revision: "473f145758162af34aadf640d0e0970d89e8e453",
        subfolder: "openai_whisper-small",
      }),
    ).toBe(
      "https://huggingface.co/argmaxinc/whisperkit-coreml/tree/473f145758162af34aadf640d0e0970d89e8e453/openai_whisper-small",
    );
  });

  it("builds a local file URL for dev-only install smoke models", () => {
    expect(
      resolveDownloadSourceUrl({
        type: "local-file",
        relativePath: "dev-models/dev-smoke-model.bin",
      }),
    ).toBe("local-file://dev-models/dev-smoke-model.bin");
  });
});
