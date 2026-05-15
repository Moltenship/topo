import { copyFile, mkdir, readFile, readdir, rm, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import { Effect } from "effect";

export interface TranscriptAudioMetadata {
  readonly audioFileName: string;
  readonly audioMimeType: "audio/wav";
  readonly audioByteSize: number;
}

export interface LoadedTranscriptAudio {
  readonly bytes: Uint8Array;
  readonly mimeType: "audio/wav";
  readonly byteSize: number;
}

export interface TranscriptAudioFileEntry {
  readonly fileName: string;
  readonly modifiedAtMs: number;
}

export interface TranscriptAudioStore {
  readonly saveWavForTranscript: (input: {
    readonly transcriptId: string;
    readonly sourcePath: string;
  }) => Effect.Effect<TranscriptAudioMetadata, Error>;
  readonly loadByFileName: (fileName: string) => Effect.Effect<LoadedTranscriptAudio, Error>;
  readonly listFileEntries: () => Effect.Effect<readonly TranscriptAudioFileEntry[], Error>;
  readonly deleteByFileNames: (fileNames: readonly string[]) => Effect.Effect<void, Error>;
}

export const createTranscriptAudioStore = (rootDirectory: string): TranscriptAudioStore => {
  const resolveFile = (fileName: string) => join(rootDirectory, assertSimpleFileName(fileName));

  return {
    saveWavForTranscript: ({ transcriptId, sourcePath }) =>
      Effect.tryPromise({
        try: async () => {
          await mkdir(rootDirectory, { recursive: true });

          const audioFileName = assertSimpleFileName(`${transcriptId}.wav`);
          const targetPath = resolveFile(audioFileName);
          await copyFile(sourcePath, targetPath);

          const saved = await stat(targetPath);
          return {
            audioFileName,
            audioMimeType: "audio/wav",
            audioByteSize: saved.size,
          };
        },
        catch: toError,
      }),
    loadByFileName: (fileName) =>
      Effect.tryPromise({
        try: async () => {
          const bytes = await readFile(resolveFile(fileName));
          return {
            bytes: new Uint8Array(bytes),
            mimeType: "audio/wav",
            byteSize: bytes.byteLength,
          };
        },
        catch: toError,
      }),
    listFileEntries: () =>
      Effect.tryPromise({
        try: async () => {
          await mkdir(rootDirectory, { recursive: true });
          const entries = await readdir(rootDirectory, { withFileTypes: true });
          const fileNames = entries
            .filter((entry) => entry.isFile())
            .map((entry) => entry.name)
            .filter(isSimpleWavFileName)
            .sort();

          return Promise.all(
            fileNames.map(async (fileName) => {
              const fileStat = await stat(resolveFile(fileName));

              return {
                fileName,
                modifiedAtMs: fileStat.mtimeMs,
              };
            }),
          );
        },
        catch: toError,
      }),
    deleteByFileNames: (fileNames) =>
      Effect.tryPromise({
        try: async () => {
          await Promise.all(
            fileNames.map((fileName) => rm(resolveFile(fileName), { force: true })),
          );
        },
        catch: toError,
      }),
  };
};

const assertSimpleFileName = (fileName: string): string => {
  if (!isSimpleWavFileName(fileName)) {
    throw new Error("Transcript audio file name must be a simple wav file name.");
  }

  return fileName;
};

const isSimpleWavFileName = (fileName: string): boolean =>
  fileName.length > 0 &&
  fileName !== "." &&
  fileName !== ".." &&
  basename(fileName) === fileName &&
  fileName.endsWith(".wav");

const toError = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error));
