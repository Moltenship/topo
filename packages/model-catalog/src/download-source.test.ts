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
});
