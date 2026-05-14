import { mkdir } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { Effect } from "effect";
import type { HuggingFaceSnapshotSource } from "@topo/model-catalog";
import { streamResponseBodyToFile } from "./artifact-install-helpers";

export interface HuggingFaceSnapshotFile {
  readonly path: string;
  readonly relativePath: string;
  readonly sizeBytes: number;
  readonly downloadUrl: string;
}

interface HuggingFaceTreeEntry {
  readonly type?: unknown;
  readonly path?: unknown;
  readonly size?: unknown;
}

const encodePathSegment = (segment: string): string =>
  encodeURIComponent(segment).replaceAll("%2F", "/");

const trimSlashes = (value: string): string => value.replace(/^\/+|\/+$/g, "");

const assertSafeRelativePath = (path: string): string => {
  const normalized = relative(".", path);

  if (normalized.startsWith("..") || normalized === "" || normalized.includes("\0")) {
    throw new Error(`Unsafe Hugging Face snapshot path: ${path}`);
  }

  return normalized;
};

export const createHuggingFaceSnapshotTreeUrl = (source: HuggingFaceSnapshotSource): string =>
  `https://huggingface.co/api/models/${encodePathSegment(source.repo)}/tree/${encodeURIComponent(
    source.revision,
  )}/${encodePathSegment(trimSlashes(source.subfolder))}?recursive=true`;

export const createHuggingFaceSnapshotFileUrl = ({
  source,
  path,
}: {
  readonly source: HuggingFaceSnapshotSource;
  readonly path: string;
}): string =>
  `https://huggingface.co/${encodePathSegment(source.repo)}/resolve/${encodeURIComponent(
    source.revision,
  )}/${encodePathSegment(path)}`;

export const listHuggingFaceSnapshotFiles = ({
  source,
  fetch,
}: {
  readonly source: HuggingFaceSnapshotSource;
  readonly fetch: typeof globalThis.fetch;
}): Effect.Effect<readonly HuggingFaceSnapshotFile[], Error> =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetch(createHuggingFaceSnapshotTreeUrl(source));

      if (!response.ok) {
        throw new Error(`Failed to list Hugging Face snapshot: HTTP ${response.status}`);
      }

      const entries = (await response.json()) as unknown;

      if (!Array.isArray(entries)) {
        throw new Error("Invalid Hugging Face snapshot tree response");
      }

      const subfolder = trimSlashes(source.subfolder);
      const files = entries.flatMap((entry: HuggingFaceTreeEntry) => {
        if (entry.type !== "file" || typeof entry.path !== "string") {
          return [];
        }

        const prefix = `${subfolder}/`;
        const relativePath = assertSafeRelativePath(
          entry.path.startsWith(prefix) ? entry.path.slice(prefix.length) : entry.path,
        );
        const sizeBytes = typeof entry.size === "number" && entry.size >= 0 ? entry.size : 0;

        return [
          {
            path: entry.path,
            relativePath,
            sizeBytes,
            downloadUrl: createHuggingFaceSnapshotFileUrl({ source, path: entry.path }),
          },
        ];
      });

      if (files.length === 0) {
        throw new Error(`Hugging Face snapshot has no files: ${source.repo}/${source.subfolder}`);
      }

      return files;
    },
    catch: (error) => (error instanceof Error ? error : new Error(String(error))),
  });

export const downloadHuggingFaceSnapshotFile = ({
  file,
  targetDirectory,
  fetch,
  abortSignal,
  onChunk,
}: {
  readonly file: HuggingFaceSnapshotFile;
  readonly targetDirectory: string;
  readonly fetch: typeof globalThis.fetch;
  readonly abortSignal: AbortSignal;
  readonly onChunk: (receivedBytes: number) => void;
}): Effect.Effect<void, Error> =>
  Effect.gen(function* () {
    const targetPath = join(targetDirectory, file.relativePath);
    yield* Effect.tryPromise({
      try: () => mkdir(dirname(targetPath), { recursive: true }),
      catch: (error) => (error instanceof Error ? error : new Error(String(error))),
    });

    const response = yield* Effect.tryPromise({
      try: () => fetch(file.downloadUrl, { signal: abortSignal }),
      catch: (error) => (error instanceof Error ? error : new Error(String(error))),
    });

    if (!response.ok || !response.body) {
      return yield* Effect.fail(
        new Error(`Failed to download Hugging Face snapshot file: HTTP ${response.status}`),
      );
    }

    yield* streamResponseBodyToFile({
      response,
      filePath: targetPath,
      abortSignal,
      onChunk,
    });
  });
