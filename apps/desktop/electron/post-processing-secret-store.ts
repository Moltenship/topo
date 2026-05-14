import { app, safeStorage } from "electron";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Effect } from "effect";

export interface PostProcessingSecretStore {
  readonly setApiKey: (storageKey: string, apiKey: string) => Effect.Effect<void, Error>;
  readonly getApiKey: (storageKey: string) => Effect.Effect<string | null, Error>;
  readonly deleteApiKey: (storageKey: string) => Effect.Effect<void, Error>;
}

interface SafeStorageAdapter {
  readonly isEncryptionAvailable: () => boolean;
  readonly encryptString: (plainText: string) => Buffer;
  readonly decryptString: (encrypted: Buffer) => string;
}

export const createPostProcessingSecretStore = ({
  rootDirectory = join(app.getPath("userData"), "post-processing-secrets"),
  storage = safeStorage,
}: {
  readonly rootDirectory?: string;
  readonly storage?: SafeStorageAdapter;
} = {}): PostProcessingSecretStore => ({
  setApiKey: (storageKey, apiKey) =>
    Effect.tryPromise({
      try: async () => {
        assertEncryptionAvailable(storage);
        const path = resolveSecretPath(rootDirectory, storageKey);
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, storage.encryptString(apiKey));
      },
      catch: toError,
    }),
  getApiKey: (storageKey) =>
    Effect.tryPromise({
      try: async () => {
        assertEncryptionAvailable(storage);
        const path = resolveSecretPath(rootDirectory, storageKey);

        try {
          return storage.decryptString(await readFile(path));
        } catch (error) {
          if (isNotFoundError(error)) {
            return null;
          }

          throw error;
        }
      },
      catch: toError,
    }),
  deleteApiKey: (storageKey) =>
    Effect.tryPromise({
      try: async () => {
        await rm(resolveSecretPath(rootDirectory, storageKey), { force: true });
      },
      catch: toError,
    }),
});

const assertEncryptionAvailable = (storage: SafeStorageAdapter) => {
  if (!storage.isEncryptionAvailable()) {
    throw new Error("Safe storage encryption is not available on this device.");
  }
};

const resolveSecretPath = (rootDirectory: string, storageKey: string): string =>
  join(rootDirectory, `${encodeURIComponent(storageKey)}.bin`);

const isNotFoundError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { readonly code?: unknown }).code === "ENOENT";

const toError = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error));
