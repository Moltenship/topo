import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { createTranscriptAudioStore } from "./transcript-audio-store";

describe("createTranscriptAudioStore", () => {
  it("copies a wav capture into transcript audio storage", async () => {
    const root = await mkdtemp(join(tmpdir(), "topo-audio-"));
    const sourcePath = join(root, "capture.wav");
    await writeFile(sourcePath, Buffer.from([1, 2, 3, 4]));
    const store = createTranscriptAudioStore(join(root, "transcript-audio"));

    const metadata = await Effect.runPromise(
      store.saveWavForTranscript({ transcriptId: "tr_1", sourcePath }),
    );

    expect(metadata).toEqual({
      audioFileName: "tr_1.wav",
      audioMimeType: "audio/wav",
      audioByteSize: 4,
    });
    await expect(readFile(join(root, "transcript-audio", "tr_1.wav"))).resolves.toEqual(
      Buffer.from([1, 2, 3, 4]),
    );
  });

  it("loads wav bytes by file name", async () => {
    const root = await mkdtemp(join(tmpdir(), "topo-audio-"));
    await writeFile(join(root, "tr_1.wav"), Buffer.from([5, 6, 7]));
    const store = createTranscriptAudioStore(root);

    const audio = await Effect.runPromise(store.loadByFileName("tr_1.wav"));

    expect(audio).toEqual({
      bytes: new Uint8Array([5, 6, 7]),
      mimeType: "audio/wav",
      byteSize: 3,
    });
  });

  it("deletes existing wav files by file name", async () => {
    const root = await mkdtemp(join(tmpdir(), "topo-audio-"));
    const audioPath = join(root, "tr_1.wav");
    await writeFile(audioPath, Buffer.from([1]));
    const store = createTranscriptAudioStore(root);

    await Effect.runPromise(store.deleteByFileNames(["tr_1.wav"]));

    await expect(stat(audioPath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("ignores missing wav files when deleting", async () => {
    const root = await mkdtemp(join(tmpdir(), "topo-audio-"));
    const store = createTranscriptAudioStore(root);

    await expect(
      Effect.runPromise(store.deleteByFileNames(["missing.wav"])),
    ).resolves.toBeUndefined();
  });

  it("rejects path traversal file names", async () => {
    const root = await mkdtemp(join(tmpdir(), "topo-audio-"));
    const store = createTranscriptAudioStore(root);

    await expect(Effect.runPromise(store.loadByFileName("../escape.wav"))).rejects.toThrow(
      "Transcript audio file name must be a simple file name.",
    );
  });
});
