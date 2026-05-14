import type { ModelCatalogEntry } from "@topo/model-catalog";
import type { InstalledModelRecord } from "@topo/shared";

export const getModelSourceRevision = (model: ModelCatalogEntry): string =>
  "revision" in model.source
    ? model.source.revision
    : "tag" in model.source
      ? model.source.tag
      : model.downloadUrl;

export const isInstalledModelOutdated = (
  installed: InstalledModelRecord,
  model: ModelCatalogEntry,
): boolean =>
  installed.sourceRevision !== getModelSourceRevision(model) ||
  installed.checksumSha256 !== model.checksumSha256;
