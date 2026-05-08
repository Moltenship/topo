import { describe, expect, it } from "vitest";
import { bundledModelCatalog, findCatalogModel, getCatalogModelDownloadUrl } from "./model-catalog";

describe("bundledModelCatalog", () => {
  it("contains English and Russian capable models", () => {
    expect(bundledModelCatalog.every((model) => model.languages.includes("en"))).toBe(true);
    expect(bundledModelCatalog.every((model) => model.languages.includes("ru"))).toBe(true);
  });

  it("keeps MVP models within the target memory envelope", () => {
    expect(
      bundledModelCatalog.every((model) => model.estimatedMemoryBytes <= 3 * 1024 * 1024 * 1024),
    ).toBe(true);
  });

  it("finds models by id", () => {
    expect(findCatalogModel("whisper-cpp-small")?.runtime).toBe("whisper-cpp");
  });

  it("derives each model download URL from its bundled source metadata", () => {
    expect(
      bundledModelCatalog.every((model) => getCatalogModelDownloadUrl(model) === model.downloadUrl),
    ).toBe(true);
  });
});
