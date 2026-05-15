# Transcript Audio Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional file-backed WAV storage and playback for transcript history, including settings test dictation, with audio sharing the same lifecycle as transcript rows.

**Architecture:** Store WAV files in `<userData>/transcript-audio/` and keep only nullable audio metadata on transcript rows. Electron main owns filesystem access through a focused transcript audio store; renderer loads audio lazily via IPC bytes and plays blob URLs. Existing transcript retention and deletion paths prune audio through a small orchestration helper in IPC handlers.

**Tech Stack:** Electron, React, TypeScript, Effect, Drizzle, better-sqlite3, shadcn/ui, ElevenLabs UI audio-player, Vitest, pnpm.

---

## File Structure

- Modify `packages/contracts/src/settings.ts`: add `saveTranscriptAudio` setting with default `false`.
- Modify `packages/settings/src/settings-schema.test.ts`: verify the new default and parser behavior.
- Modify `packages/contracts/src/dictation.ts`: add nullable audio metadata to `TranscriptRecord`.
- Modify `packages/contracts/src/ipc.ts`: add `history:load-transcript-audio` channel and request/response schemas.
- Modify `packages/shared/src/ipc.ts`: re-export new IPC contracts.
- Modify `packages/shared/src/index.ts`: extend `TopoApi` with `loadTranscriptAudio`.
- Modify `packages/db/src/schema.ts`: add nullable audio columns to `transcripts`.
- Modify `packages/db/src/migrations.ts`: add `0004_transcript_audio_metadata`.
- Modify `packages/db/src/transcript-repository.ts`: add metadata-aware row mapping plus `getAudioFileNames*` helpers.
- Modify `packages/db/src/transcript-repository.test.ts`: cover audio metadata and filename helper behavior.
- Modify `packages/db/src/app-database.test.ts`: ensure migrated DB has audio columns and can persist metadata.
- Create `apps/desktop/electron/transcript-audio-store.ts`: copy temp WAVs into app data, read WAV bytes, delete saved files.
- Create `apps/desktop/electron/transcript-audio-store.test.ts`: cover save/load/delete behavior.
- Modify `apps/desktop/electron/main.ts`: construct and inject transcript audio store.
- Modify `apps/desktop/electron/ipc-handlers.ts`: save audio after successful dictation, load audio over IPC, and clean files during delete/clear/prune.
- Modify `apps/desktop/electron/ipc-handlers.test.ts`: cover save/no-save/load/delete orchestration.
- Modify `packages/asr/src/dictation-orchestrator.ts`: add an optional capture-preservation callback that runs before temporary audio cleanup.
- Modify `packages/asr/src/dictation-orchestrator.test.ts`: verify the callback receives the temp audio path and metadata is attached.
- Modify `apps/desktop/electron/preload.ts`: expose `loadTranscriptAudio`.
- Install/add `apps/desktop/renderer/src/components/ui/audio-player.tsx`: ElevenLabs UI audio player component.
- Modify `apps/desktop/renderer/src/features/history/history-view.tsx`: render lazy player for rows with audio metadata.
- Modify `apps/desktop/renderer/src/features/settings/settings-page.tsx`: add History setting and update retention copy.

## Task 1: Contracts And Settings

**Files:**
- Modify: `packages/contracts/src/settings.ts`
- Modify: `packages/contracts/src/dictation.ts`
- Modify: `packages/contracts/src/ipc.ts`
- Modify: `packages/shared/src/ipc.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/settings/src/settings-schema.test.ts`
- Test: `packages/contracts/src/dictation.test.ts`
- Test: `packages/contracts/src/ipc.test.ts`

- [ ] **Step 1: Write failing settings tests**

Add `saveTranscriptAudio: false` to the default assertion in `packages/settings/src/settings-schema.test.ts`, and add this parser assertion:

```ts
it("accepts transcript audio saving preference", () => {
  expect(parseAppSettings({ saveTranscriptAudio: true }).saveTranscriptAudio).toBe(true);
});
```

- [ ] **Step 2: Write failing transcript contract tests**

In `packages/contracts/src/dictation.test.ts`, add a case that decodes a transcript without audio fields and expects null defaults, plus a case with populated metadata:

```ts
expect(
  Schema.decodeUnknownSync(TranscriptRecord)({
    id: "tr_1",
    text: "hello",
    createdAt: "2026-05-15T00:00:00.000Z",
    durationMs: 1000,
    modelId: "model",
    runtime: "whisper-cpp",
    language: "en",
    recordingMode: "toggle-to-talk",
    stopReason: "hotkey-release",
    insertionMode: "paste",
    insertionStatus: "inserted",
    targetAppName: null,
  }).audioFileName,
).toBeNull();

expect(
  Schema.decodeUnknownSync(TranscriptRecord)({
    id: "tr_2",
    text: "hello",
    createdAt: "2026-05-15T00:00:00.000Z",
    durationMs: 1000,
    modelId: "model",
    runtime: "whisper-cpp",
    language: "en",
    recordingMode: "toggle-to-talk",
    stopReason: "hotkey-release",
    insertionMode: "paste",
    insertionStatus: "inserted",
    targetAppName: null,
    audioFileName: "tr_2.wav",
    audioMimeType: "audio/wav",
    audioByteSize: 48,
  }).audioMimeType,
).toBe("audio/wav");
```

- [ ] **Step 3: Write failing IPC contract tests**

In `packages/contracts/src/ipc.test.ts`, assert the new channel and response schema:

```ts
expect(IpcChannels.loadTranscriptAudio).toBe("history:load-transcript-audio");
expect(
  Schema.decodeUnknownSync(LoadTranscriptAudioResponse)({
    bytes: new Uint8Array([1, 2, 3]),
    mimeType: "audio/wav",
    byteSize: 3,
  }).byteSize,
).toBe(3);
```

- [ ] **Step 4: Run failing contract/settings tests**

Run:

```bash
pnpm --filter @topo/settings test
pnpm --filter @topo/contracts test
```

Expected: failures for missing `saveTranscriptAudio`, transcript audio fields, and IPC contracts.

- [ ] **Step 5: Implement settings and transcript contracts**

In `packages/contracts/src/settings.ts`, add:

```ts
saveTranscriptAudio: Schema.optionalWith(Schema.Boolean, { default: () => false }),
```

In `packages/contracts/src/dictation.ts`, add to `TranscriptRecord`:

```ts
audioFileName: Schema.optionalWith(Schema.NullOr(Schema.String), { default: () => null }),
audioMimeType: Schema.optionalWith(Schema.NullOr(Schema.String), { default: () => null }),
audioByteSize: Schema.optionalWith(Schema.NullOr(Schema.Number), { default: () => null }),
```

- [ ] **Step 6: Implement IPC contracts and shared API**

In `packages/contracts/src/ipc.ts`, add channel:

```ts
loadTranscriptAudio: "history:load-transcript-audio",
```

Add schemas:

```ts
export const LoadTranscriptAudioRequest = DeleteTranscriptRequest;
export type LoadTranscriptAudioRequest = typeof LoadTranscriptAudioRequest.Type;

export const LoadTranscriptAudioResponse = Schema.Struct({
  bytes: Schema.Uint8ArrayFromSelf,
  mimeType: Schema.String,
  byteSize: Schema.Number,
});
export type LoadTranscriptAudioResponse = typeof LoadTranscriptAudioResponse.Type;
```

Re-export these from `packages/shared/src/ipc.ts`, and add this to `TopoApi` in `packages/shared/src/index.ts`:

```ts
readonly loadTranscriptAudio: (id: string) => Promise<LoadTranscriptAudioResponse>;
```

Import `LoadTranscriptAudioResponse` type from `@topo/contracts` where `TopoApi` types are imported.

- [ ] **Step 7: Run tests and commit**

Run:

```bash
pnpm --filter @topo/settings test
pnpm --filter @topo/contracts test
```

Expected: pass.

Commit:

```bash
git add packages/contracts/src/settings.ts packages/contracts/src/dictation.ts packages/contracts/src/ipc.ts packages/shared/src/ipc.ts packages/shared/src/index.ts packages/settings/src/settings-schema.test.ts packages/contracts/src/dictation.test.ts packages/contracts/src/ipc.test.ts
git commit -m "feat: add transcript audio contracts" -m "Co-authored-by: Codex <noreply@openai.com>"
```

## Task 2: Database Metadata

**Files:**
- Modify: `packages/db/src/schema.ts`
- Modify: `packages/db/src/migrations.ts`
- Modify: `packages/db/src/transcript-repository.ts`
- Test: `packages/db/src/transcript-repository.test.ts`
- Test: `packages/db/src/app-database.test.ts`

- [ ] **Step 1: Write failing repository tests**

Update the in-memory test table in `packages/db/src/transcript-repository.test.ts` with:

```sql
audio_file_name TEXT,
audio_mime_type TEXT,
audio_byte_size INTEGER
```

Add a test:

```ts
it("stores transcript audio metadata", async () => {
  const repository = createMemoryRepository();

  await Effect.runPromise(
    repository.insert({
      id: "tr_audio",
      text: "audio transcript",
      createdAt: "2026-05-15T00:00:00.000Z",
      durationMs: 1200,
      modelId: "whisper-cpp-small",
      runtime: "whisper-cpp",
      language: "en",
      recordingMode: "toggle-to-talk",
      stopReason: "hotkey-release",
      insertionMode: "paste",
      insertionStatus: "inserted",
      targetAppName: null,
      audioFileName: "tr_audio.wav",
      audioMimeType: "audio/wav",
      audioByteSize: 45,
    }),
  );

  await expect(Effect.runPromise(repository.getById("tr_audio"))).resolves.toMatchObject({
    audioFileName: "tr_audio.wav",
    audioMimeType: "audio/wav",
    audioByteSize: 45,
  });
});
```

Add helper tests:

```ts
await expect(Effect.runPromise(repository.getAudioFileNameById("tr_audio"))).resolves.toBe(
  "tr_audio.wav",
);
await expect(
  Effect.runPromise(repository.getAudioFileNamesCreatedBefore("2026-05-16T00:00:00.000Z")),
).resolves.toEqual(["tr_audio.wav"]);
```

- [ ] **Step 2: Write failing migration test**

In `packages/db/src/app-database.test.ts`, add a test that opens a temp app database, inspects `PRAGMA table_info(transcripts)`, and expects `audio_file_name`, `audio_mime_type`, `audio_byte_size`.

- [ ] **Step 3: Run failing DB tests**

Run:

```bash
pnpm --filter @topo/db test
```

Expected: failures for missing columns and helper methods.

- [ ] **Step 4: Implement schema and migration**

In `packages/db/src/schema.ts`, add:

```ts
audioFileName: text("audio_file_name"),
audioMimeType: text("audio_mime_type"),
audioByteSize: integer("audio_byte_size"),
```

In `packages/db/src/migrations.ts`, append:

```ts
{
  id: "0004_transcript_audio_metadata",
  sql: `
    ALTER TABLE transcripts ADD COLUMN audio_file_name TEXT;
    ALTER TABLE transcripts ADD COLUMN audio_mime_type TEXT;
    ALTER TABLE transcripts ADD COLUMN audio_byte_size INTEGER;
  `,
}
```

- [ ] **Step 5: Implement repository helpers**

Extend `TranscriptRepository` in `packages/db/src/transcript-repository.ts`:

```ts
readonly getAudioFileNameById: (id: string) => Effect.Effect<string | null>;
readonly getAudioFileNamesCreatedBefore: (cutoffIso: string) => Effect.Effect<readonly string[]>;
readonly listAudioFileNames: () => Effect.Effect<readonly string[]>;
```

Implement helpers with `select({ audioFileName: transcripts.audioFileName })`, filtering nulls in TypeScript. Keep `deleteById`, `deleteCreatedBefore`, and `clear` as DB-only operations; file cleanup is orchestrated in Electron main.

- [ ] **Step 6: Run DB tests and commit**

Run:

```bash
pnpm --filter @topo/db test
```

Expected: pass.

Commit:

```bash
git add packages/db/src/schema.ts packages/db/src/migrations.ts packages/db/src/transcript-repository.ts packages/db/src/transcript-repository.test.ts packages/db/src/app-database.test.ts
git commit -m "feat: persist transcript audio metadata" -m "Co-authored-by: Codex <noreply@openai.com>"
```

## Task 3: Transcript Audio Store

**Files:**
- Create: `apps/desktop/electron/transcript-audio-store.ts`
- Create: `apps/desktop/electron/transcript-audio-store.test.ts`

- [ ] **Step 1: Write failing audio store tests**

Create tests for save/load/delete:

```ts
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
});
```

Add tests for `loadByFileName("tr_1.wav")` returning bytes and for `deleteByFileNames(["tr_1.wav"])` removing the file and ignoring a missing file.

- [ ] **Step 2: Run failing audio store tests**

Run:

```bash
pnpm --filter @topo/desktop test -- transcript-audio-store
```

Expected: fail because the module does not exist.

- [ ] **Step 3: Implement audio store**

Create `apps/desktop/electron/transcript-audio-store.ts`:

```ts
import { copyFile, mkdir, readFile, rm, stat } from "node:fs/promises";
import { join } from "node:path";
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

export interface TranscriptAudioStore {
  readonly saveWavForTranscript: (input: {
    readonly transcriptId: string;
    readonly sourcePath: string;
  }) => Effect.Effect<TranscriptAudioMetadata, Error>;
  readonly loadByFileName: (fileName: string) => Effect.Effect<LoadedTranscriptAudio, Error>;
  readonly deleteByFileNames: (fileNames: readonly string[]) => Effect.Effect<void>;
}

export const createTranscriptAudioStore = (rootDirectory: string): TranscriptAudioStore => {
  const resolveFile = (fileName: string) => join(rootDirectory, fileName);

  return {
    saveWavForTranscript: ({ transcriptId, sourcePath }) =>
      Effect.tryPromise({
        try: async () => {
          await mkdir(rootDirectory, { recursive: true });
          const audioFileName = `${transcriptId}.wav`;
          const targetPath = resolveFile(audioFileName);
          await copyFile(sourcePath, targetPath);
          const saved = await stat(targetPath);
          return {
            audioFileName,
            audioMimeType: "audio/wav",
            audioByteSize: saved.size,
          };
        },
        catch: (error) => (error instanceof Error ? error : new Error(String(error))),
      }),
    loadByFileName: (fileName) =>
      Effect.tryPromise({
        try: async () => {
          const bytes = await readFile(resolveFile(fileName));
          return { bytes: new Uint8Array(bytes), mimeType: "audio/wav", byteSize: bytes.byteLength };
        },
        catch: (error) => (error instanceof Error ? error : new Error(String(error))),
      }),
    deleteByFileNames: (fileNames) =>
      Effect.promise(async () => {
        await Promise.all(
          fileNames.map((fileName) => rm(resolveFile(fileName), { force: true })),
        );
      }),
  };
};
```

- [ ] **Step 4: Run audio store tests and commit**

Run:

```bash
pnpm --filter @topo/desktop test -- transcript-audio-store
```

Expected: pass.

Commit:

```bash
git add apps/desktop/electron/transcript-audio-store.ts apps/desktop/electron/transcript-audio-store.test.ts
git commit -m "feat: add transcript audio file store" -m "Co-authored-by: Codex <noreply@openai.com>"
```

## Task 4: Electron Save, Load, And Cleanup Orchestration

**Files:**
- Modify: `packages/asr/src/dictation-orchestrator.ts`
- Test: `packages/asr/src/dictation-orchestrator.test.ts`
- Modify: `apps/desktop/electron/main.ts`
- Modify: `apps/desktop/electron/ipc-handlers.ts`
- Modify: `apps/desktop/electron/preload.ts`
- Test: `apps/desktop/electron/ipc-handlers.test.ts`

- [ ] **Step 1: Write failing orchestrator callback test**

In `packages/asr/src/dictation-orchestrator.test.ts`, add a test where `stop` receives `preserveCapturedAudio` and expects the callback to run before cleanup:

```ts
it("attaches preserved audio metadata before cleaning up captured audio", async () => {
  const cleanupCalls: string[] = [];
  const orchestrator = createDictationOrchestrator({
    audio: {
      startRecording: () => Effect.void,
      stopRecording: () =>
        Effect.succeed({
          sessionId: "session_1",
          audioPath: "/tmp/topo-capture.wav",
          durationMs: 1200,
        }),
      cleanupCapturedAudio: (audio) =>
        Effect.sync(() => {
          cleanupCalls.push(audio.audioPath);
        }),
      onLevelFrame: () => () => undefined,
    },
    transcription: {
      transcribe: () => Effect.succeed({ text: "hello", language: "en" }),
    },
    postProcessing: {
      process: ({ rawTranscript }) => Effect.succeed({ text: rawTranscript, warning: null }),
    },
    now: () => new Date("2026-05-15T00:00:00.000Z"),
    createId: () => "tr_audio",
  });

  await Effect.runPromise(orchestrator.start());
  const transcript = await Effect.runPromise(
    orchestrator.stop({
      language: "en",
      modelId: "whisper-cpp-small",
      runtime: "whisper-cpp",
      installedModelPath: "/models/model.bin",
      runtimeBinaryPath: "/bin/whisper-cli",
      postProcessingMode: "raw",
      recordingMode: "toggle-to-talk",
      preserveCapturedAudio: ({ transcriptId, audioPath }) =>
        Effect.succeed({
          audioFileName: `${transcriptId}.wav`,
          audioMimeType: "audio/wav",
          audioByteSize: audioPath.length,
        }),
    }),
  );

  expect(transcript.audioFileName).toBe("tr_audio.wav");
  expect(cleanupCalls).toEqual(["/tmp/topo-capture.wav"]);
});
```

- [ ] **Step 2: Write failing IPC tests**

In `apps/desktop/electron/ipc-handlers.test.ts`, add fake `transcriptAudioStore` methods and tests for:

```ts
expect(savedInput).toEqual({ transcriptId: transcript.id, sourcePath: capturedAudioPath });
expect(insertedTranscript.audioFileName).toBe(`${transcript.id}.wav`);
```

Add negative tests where `historyEnabled: false` and `saveTranscriptAudio: false` both assert `saveWavForTranscript` was not called and inserted transcript metadata is null.

Add load test:

```ts
await expect(api.loadTranscriptAudio("tr_audio")).resolves.toMatchObject({
  mimeType: "audio/wav",
  byteSize: 4,
});
```

Add delete/clear/prune tests that assert `deleteByFileNames` receives the file names before repository rows disappear.

- [ ] **Step 3: Run failing ASR and Electron tests**

Run:

```bash
pnpm --filter @topo/asr test -- dictation-orchestrator
pnpm --filter @topo/desktop test -- ipc-handlers
```

Expected: fail because the orchestrator callback, dependencies, preload API, and IPC handler do not exist.

- [ ] **Step 4: Add orchestrator preservation callback**

In `packages/asr/src/dictation-orchestrator.ts`, add:

```ts
export interface PreservedCapturedAudioMetadata {
  readonly audioFileName: string;
  readonly audioMimeType: string;
  readonly audioByteSize: number;
}
```

Extend the `stop` input type:

```ts
readonly preserveCapturedAudio?: (input: {
  readonly transcriptId: string;
  readonly audioPath: string;
}) => Effect.Effect<PreservedCapturedAudioMetadata, Error>;
```

Restructure `stop` so `Effect.acquireUseRelease` wraps transcription, post-processing, transcript creation, and optional preservation. Inside the `use` callback:

```ts
const transcriptId = dependencies.createId();
const preservedAudio = input.preserveCapturedAudio
  ? yield* input
      .preserveCapturedAudio({ transcriptId, audioPath: capturedAudio.audioPath })
      .pipe(Effect.catchAll(() => Effect.succeed(null)))
  : null;

return {
  id: transcriptId,
  text: processed.text,
  createdAt: dependencies.now().toISOString(),
  durationMs: capturedAudio.durationMs,
  modelId: input.modelId,
  runtime: input.runtime,
  language: result.language,
  recordingMode: input.recordingMode,
  stopReason: "hotkey-release",
  insertionMode: "paste",
  insertionStatus: "skipped",
  targetAppName: null,
  audioFileName: preservedAudio?.audioFileName ?? null,
  audioMimeType: preservedAudio?.audioMimeType ?? null,
  audioByteSize: preservedAudio?.audioByteSize ?? null,
};
```

This ensures the temporary capture still exists when the callback copies it, and cleanup still runs through the existing release finalizer.

- [ ] **Step 5: Inject audio store**

In `apps/desktop/electron/main.ts`, import and create:

```ts
import { createTranscriptAudioStore } from "./transcript-audio-store";

const transcriptAudioStore = createTranscriptAudioStore(join(userDataDirectory, "transcript-audio"));
```

Pass `transcriptAudioStore` into `registerIpcHandlers`.

- [ ] **Step 6: Save audio metadata during dictation stops**

In `apps/desktop/electron/ipc-handlers.ts`, add dependency:

```ts
readonly transcriptAudioStore?: TranscriptAudioStore;
```

Create helper:

```ts
const preserveCapturedAudio = (
  dependencies: IpcHandlerDependencies,
  settings: AppSettings,
): Parameters<DictationOrchestrator["stop"]>[0]["preserveCapturedAudio"] | undefined => {
  if (!settings.historyEnabled || !settings.saveTranscriptAudio || !dependencies.transcriptAudioStore) {
    return undefined;
  }

  return ({ transcriptId, audioPath }) =>
    dependencies.transcriptAudioStore!.saveWavForTranscript({
      transcriptId,
      sourcePath: audioPath,
    });
};
```

Pass `preserveCapturedAudio: preserveCapturedAudio(dependencies, settings)` into every `dependencies.dictation.stop(...)` call in both normal dictation and settings test dictation.

- [ ] **Step 7: Implement load and cleanup IPC**

Add `ipcMain.handle(IpcChannels.loadTranscriptAudio, ...)` that decodes `LoadTranscriptAudioRequest`, loads the transcript, checks `audioFileName`, and returns `transcriptAudioStore.loadByFileName(audioFileName)`.

Before `deleteById`, call `getAudioFileNameById`; before `clear`, call `listAudioFileNames`; before `deleteCreatedBefore`, call `getAudioFileNamesCreatedBefore`. After collecting names, delete DB rows, then call `deleteByFileNames(names)`. Missing files are ignored by the store.

- [ ] **Step 8: Expose preload API**

In `apps/desktop/electron/preload.ts`, add:

```ts
loadTranscriptAudio: (id) => ipcRenderer.invoke(IpcChannels.loadTranscriptAudio, { id }),
```

- [ ] **Step 9: Run ASR/Electron tests and commit**

Run:

```bash
pnpm --filter @topo/asr test -- dictation-orchestrator
pnpm --filter @topo/desktop test -- ipc-handlers
```

Expected: pass.

Commit:

```bash
git add packages/asr/src/dictation-orchestrator.ts packages/asr/src/dictation-orchestrator.test.ts apps/desktop/electron/main.ts apps/desktop/electron/ipc-handlers.ts apps/desktop/electron/preload.ts apps/desktop/electron/ipc-handlers.test.ts
git commit -m "feat: save transcript audio from dictation" -m "Co-authored-by: Codex <noreply@openai.com>"
```

## Task 5: History Playback UI And Setting

**Files:**
- Add/Modify: `apps/desktop/renderer/src/components/ui/audio-player.tsx`
- Modify: `apps/desktop/renderer/src/features/history/history-view.tsx`
- Modify: `apps/desktop/renderer/src/features/settings/settings-page.tsx`

- [ ] **Step 1: Add ElevenLabs UI audio player**

Run:

```bash
npx @elevenlabs/cli@latest components add audio-player
```

Expected: creates or updates `apps/desktop/renderer/src/components/ui/audio-player.tsx`. Run the command from `apps/desktop` so the component lands in the renderer component tree configured by `apps/desktop/components.json`.

- [ ] **Step 2: Add setting row**

In `apps/desktop/renderer/src/features/settings/settings-page.tsx`, add a History row after `Transcript history`:

```tsx
<SettingsRow
  title="Save transcript audio"
  description="Store WAV audio with transcript history. Saved audio is deleted with its transcript."
  resetAction={getResetAction("saveTranscriptAudio", "saved transcript audio")}
>
  <SettingsSwitch
    disabled={!settings || !settings.historyEnabled}
    checked={settings?.saveTranscriptAudio ?? false}
    onChange={(value) => updateSettings("saveTranscriptAudio", value)}
  />
</SettingsRow>
```

Update auto-delete copy:

```tsx
description="Remove local transcripts and saved audio after the selected retention period."
```

- [ ] **Step 3: Add lazy history audio player**

In `apps/desktop/renderer/src/features/history/history-view.tsx`, add a child component:

```tsx
const TranscriptAudioPlayer = ({ transcriptId }: { readonly transcriptId: string }) => {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (src) URL.revokeObjectURL(src);
    };
  }, [src]);

  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (src || loading) return;
    setLoading(true);
    const audio = await getRendererApi().loadTranscriptAudio(transcriptId);
    const nextSrc = URL.createObjectURL(new Blob([audio.bytes], { type: audio.mimeType }));
    setSrc(nextSrc);
    setLoading(false);
  };

  return (
    <div className="mt-3 flex items-center gap-2">
      {src ? (
        <AudioPlayerProvider>
          <AudioPlayerButton item={{ id: transcriptId, src }} size="icon" variant="outline" />
          <AudioPlayerProgress className="w-full" />
          <AudioPlayerTime />
          <AudioPlayerDuration />
        </AudioPlayerProvider>
      ) : (
        <Button size="sm" variant="outline" disabled={loading} onClick={() => void load()}>
          Load audio
        </Button>
      )}
    </div>
  );
};
```

Render it inside each card only when `item.audioFileName !== null`. Import `useEffect`, `useState`, `getRendererApi`, and the generated audio player exports at the top of `history-view.tsx`.

- [ ] **Step 4: Run renderer typecheck**

Run:

```bash
pnpm --filter @topo/desktop typecheck
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/renderer/src/components/ui/audio-player.tsx apps/desktop/renderer/src/features/history/history-view.tsx apps/desktop/renderer/src/features/settings/settings-page.tsx
git commit -m "feat: add transcript audio playback UI" -m "Co-authored-by: Codex <noreply@openai.com>"
```

## Task 6: Full Verification

**Files:**
- No planned source changes unless verification exposes defects.

- [ ] **Step 1: Run focused package tests**

Run:

```bash
pnpm --filter @topo/contracts test
pnpm --filter @topo/settings test
pnpm --filter @topo/db test
pnpm --filter @topo/desktop test
```

Expected: all pass.

- [ ] **Step 2: Run project check**

Run:

```bash
pnpm run check
```

Expected: typecheck, formatting, and lint all pass.

- [ ] **Step 3: Fix verification-only issues**

When `pnpm run check` reports formatting, run:

```bash
pnpm run fmt
pnpm run check
```

When typecheck or lint reports a concrete issue, fix only the files touched by this plan, then rerun `pnpm run check`.

- [ ] **Step 4: Commit verification fixes when verification changed tracked files**

When verification changed tracked files already touched by this plan, stage those tracked modifications and commit them:

```bash
git add -u
git commit -m "fix: satisfy transcript audio checks" -m "Co-authored-by: Codex <noreply@openai.com>"
```

Expected: clean worktree except intentional untracked local artifacts. When verification did not change files, skip this commit step.
