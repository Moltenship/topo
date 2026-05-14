import { describe, expect, it } from "vitest";
import {
  bundledDevModelCatalog,
  bundledModelCatalog,
  findCatalogModel,
  getBundledModelCatalog,
  getCatalogModelDownloadUrl,
} from "./model-catalog";

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

  it("declares runtime requirements and comparison scores for every model", () => {
    expect(
      getBundledModelCatalog({ includeDev: true }).every(
        (model) =>
          model.runtimeRequirement.engine === model.runtime &&
          (model.experimental || model.runtimeRequirement.supportedRuntimeIds.length > 0) &&
          model.accuracyScore >= 0 &&
          model.accuracyScore <= 100 &&
          model.speedScore >= 0 &&
          model.speedScore <= 100 &&
          model.recommendedReason.length > 0,
      ),
    ).toBe(true);
  });

  it("derives each model download URL from its bundled source metadata", () => {
    expect(
      getBundledModelCatalog({ includeDev: true }).every(
        (model) => getCatalogModelDownloadUrl(model) === model.downloadUrl,
      ),
    ).toBe(true);
  });

  it("keeps dev-only smoke models out of the production catalog", () => {
    expect(bundledDevModelCatalog.every((model) => model.devOnly)).toBe(true);
    expect(getBundledModelCatalog({ includeDev: false }).some((model) => model.devOnly)).toBe(
      false,
    );
    expect(
      getBundledModelCatalog({ includeDev: true }).some((model) => model.id === "dev-smoke-model"),
    ).toBe(true);
  });
});
