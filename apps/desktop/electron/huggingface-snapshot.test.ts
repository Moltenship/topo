import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import type { HuggingFaceSnapshotSource } from "@topo/model-catalog";
import {
  createHuggingFaceSnapshotFileUrl,
  createHuggingFaceSnapshotTreeUrl,
  downloadHuggingFaceSnapshotFile,
  listHuggingFaceSnapshotFiles,
} from "./huggingface-snapshot";

const source: HuggingFaceSnapshotSource = {
  type: "huggingface-snapshot",
  repo: "argmaxinc/whisperkit-coreml",
  revision: "97a5bf9bbc74c7d9c12c755d04dea59e672e3808",
  subfolder: "openai_whisper-small",
};

describe("huggingface snapshot helpers", () => {
  it("builds tree and resolve URLs for a snapshot subfolder", () => {
    expect(createHuggingFaceSnapshotTreeUrl(source)).toBe(
      "https://huggingface.co/api/models/argmaxinc/whisperkit-coreml/tree/97a5bf9bbc74c7d9c12c755d04dea59e672e3808/openai_whisper-small?recursive=true",
    );
    expect(
      createHuggingFaceSnapshotFileUrl({
        source,
        path: "openai_whisper-small/AudioEncoder.mlmodelc/metadata.json",
      }),
    ).toBe(
      "https://huggingface.co/argmaxinc/whisperkit-coreml/resolve/97a5bf9bbc74c7d9c12c755d04dea59e672e3808/openai_whisper-small/AudioEncoder.mlmodelc/metadata.json",
    );
  });

  it("lists only files and strips the configured subfolder prefix", async () => {
    const files = await Effect.runPromise(
      listHuggingFaceSnapshotFiles({
        source,
        fetch: async () =>
          Response.json([
            {
              type: "directory",
              path: "openai_whisper-small/AudioEncoder.mlmodelc",
              size: 0,
            },
            {
              type: "file",
              path: "openai_whisper-small/AudioEncoder.mlmodelc/metadata.json",
              size: 1868,
            },
          ]),
      }),
    );

    expect(files).toEqual([
      {
        path: "openai_whisper-small/AudioEncoder.mlmodelc/metadata.json",
        relativePath: "AudioEncoder.mlmodelc/metadata.json",
        sizeBytes: 1868,
        downloadUrl:
          "https://huggingface.co/argmaxinc/whisperkit-coreml/resolve/97a5bf9bbc74c7d9c12c755d04dea59e672e3808/openai_whisper-small/AudioEncoder.mlmodelc/metadata.json",
      },
    ]);
  });

  it("downloads a snapshot file into its relative directory", async () => {
    const targetDirectory = await mkdtemp(join(tmpdir(), "topo-hf-snapshot-"));

    await Effect.runPromise(
      downloadHuggingFaceSnapshotFile({
        file: {
          path: "openai_whisper-small/AudioEncoder.mlmodelc/metadata.json",
          relativePath: "AudioEncoder.mlmodelc/metadata.json",
          sizeBytes: 2,
          downloadUrl: "https://example.test/metadata.json",
        },
        targetDirectory,
        fetch: async () => new Response("{}"),
        abortSignal: new AbortController().signal,
        onChunk: () => undefined,
      }),
    );

    await expect(
      readFile(join(targetDirectory, "AudioEncoder.mlmodelc", "metadata.json"), "utf8"),
    ).resolves.toBe("{}");
  });
});
