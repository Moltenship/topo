import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Effect } from "effect";
import type { ModelInstallProgress } from "@topo/shared";

export const createInstallProgress = (
  modelId: string,
  status: ModelInstallProgress["status"],
  receivedBytes: number,
  totalBytes: number,
  errorMessage: string | null = null,
): ModelInstallProgress => ({
  modelId,
  status,
  receivedBytes,
  totalBytes,
  percent: totalBytes > 0 ? Math.min(1, receivedBytes / totalBytes) : 0,
  errorMessage,
});

export const calculateFileSha256 = (path: string): Effect.Effect<string, Error> =>
  Effect.tryPromise({
    try: async () => {
      const hash = createHash("sha256");
      await pipeline(createReadStream(path), hash);

      return hash.digest("hex");
    },
    catch: (error) => (error instanceof Error ? error : new Error(String(error))),
  });

export const readContentLength = (response: Response): number | null => {
  const value = response.headers.get("content-length");

  if (!value) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

export const streamResponseBodyToFile = ({
  response,
  filePath,
  abortSignal,
  onChunk,
}: {
  readonly response: Response;
  readonly filePath: string;
  readonly abortSignal: AbortSignal;
  readonly onChunk: (receivedBytes: number) => void;
}): Effect.Effect<void, Error> =>
  Effect.tryPromise({
    try: async () => {
      if (!response.body) {
        throw new Error("Response body is missing");
      }

      const reader = response.body.getReader();
      const writeStream = createWriteStream(filePath);
      let receivedBytes = 0;

      try {
        while (true) {
          if (abortSignal.aborted) {
            throw new Error("Artifact install canceled");
          }

          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          receivedBytes += value.byteLength;
          if (!writeStream.write(value)) {
            await new Promise<void>((resolve) => writeStream.once("drain", resolve));
          }

          onChunk(receivedBytes);
        }
      } finally {
        writeStream.end();
        await new Promise<void>((resolve, reject) => {
          writeStream.once("finish", resolve);
          writeStream.once("error", reject);
        });
      }
    },
    catch: (error) => (error instanceof Error ? error : new Error(String(error))),
  });
