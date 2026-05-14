import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { Effect } from "effect";
import * as Schema from "effect/Schema";
import {
  type ModelCatalogEntry,
  ModelCatalogManifest,
  modelCatalogManifestToCatalog,
} from "@topo/model-catalog";

export interface ModelCatalogService {
  readonly load: () => Effect.Effect<readonly ModelCatalogEntry[], never>;
}

export interface ModelCatalogServiceOptions {
  readonly bundledCatalog: readonly ModelCatalogEntry[];
  readonly cachePath: string;
  readonly manifestUrl: string | null;
  readonly fetch: typeof fetch;
}

const mergeCatalog = (
  bundledCatalog: readonly ModelCatalogEntry[],
  remoteCatalog: readonly ModelCatalogEntry[],
): readonly ModelCatalogEntry[] => {
  const remoteById = new Map(remoteCatalog.map((model) => [model.id, model] as const));
  const merged = bundledCatalog.map((model) => remoteById.get(model.id) ?? model);
  const bundledIds = new Set(bundledCatalog.map((model) => model.id));
  const remoteOnly = remoteCatalog.filter((model) => !bundledIds.has(model.id));

  return [...merged, ...remoteOnly];
};

const decodeManifestCatalog = (input: unknown): readonly ModelCatalogEntry[] =>
  modelCatalogManifestToCatalog(Schema.decodeUnknownSync(ModelCatalogManifest)(input));

const readCachedCatalog = (
  cachePath: string,
): Effect.Effect<readonly ModelCatalogEntry[] | null, never> =>
  Effect.promise(async () => {
    try {
      return decodeManifestCatalog(JSON.parse(await readFile(cachePath, "utf8")));
    } catch {
      return null;
    }
  });

const writeCachedManifest = (cachePath: string, manifest: unknown): Effect.Effect<void, never> =>
  Effect.promise(async () => {
    try {
      await mkdir(dirname(cachePath), { recursive: true });
      await writeFile(cachePath, `${JSON.stringify(manifest, null, 2)}\n`);
    } catch {
      return undefined;
    }
  });

export const createModelCatalogService = ({
  bundledCatalog,
  cachePath,
  manifestUrl,
  fetch,
}: ModelCatalogServiceOptions): ModelCatalogService => ({
  load: () =>
    Effect.gen(function* () {
      if (!manifestUrl) {
        return bundledCatalog;
      }

      const remoteManifest = yield* Effect.promise(async () => {
        try {
          const response = await fetch(manifestUrl);

          if (!response.ok) {
            throw new Error(`Failed to fetch model manifest: HTTP ${response.status}`);
          }

          return await response.json();
        } catch {
          return null;
        }
      });

      if (remoteManifest) {
        const remoteCatalog = yield* Effect.sync(() => {
          try {
            return decodeManifestCatalog(remoteManifest);
          } catch {
            return null;
          }
        });

        if (remoteCatalog) {
          yield* writeCachedManifest(cachePath, remoteManifest);

          return mergeCatalog(bundledCatalog, remoteCatalog);
        }
      }

      const cachedCatalog = yield* readCachedCatalog(cachePath);

      return cachedCatalog ? mergeCatalog(bundledCatalog, cachedCatalog) : bundledCatalog;
    }),
});
