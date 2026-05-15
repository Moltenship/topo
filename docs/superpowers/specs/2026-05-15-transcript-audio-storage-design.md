# Transcript Audio Storage Design

## Context

Topo currently stores transcript history as text-only SQLite rows. Captured WAV audio is temporary: the dictation orchestrator passes the temporary file to the transcription provider and then asks the audio service to clean it up.

Handy uses a useful boundary for this feature: audio recordings are file-backed in an app-data recordings directory, while history rows store only enough metadata to find and manage the file. Topo should follow that model, with one important simplification for v1: audio retention is identical to transcript retention.

## Goals

- Make saving transcript audio optional.
- Save WAV audio for both normal dictation and settings test dictation when enabled.
- Keep text history and saved audio on the same lifecycle.
- Keep raw audio bytes out of SQLite.
- Add playback to history using a shadcn-compatible audio player.
- Preserve current behavior by default.

## Non-Goals

- No compressed audio format in v1.
- No separate audio retention policy.
- No audio saved when transcript history is disabled.
- No transcription retry from saved audio in v1.
- No cloud storage or sync.

## User-Facing Behavior

Add a History setting named `Save transcript audio`, default `false`.

When transcript history is enabled and this setting is on, Topo saves the WAV audio for every successful transcript, including settings test dictations. History entries with saved audio show an inline player. When the transcript is deleted, cleared, or pruned by auto-delete, the WAV file is deleted with it.

When transcript history is off, audio is not saved, even if the audio setting was previously enabled. The UI should communicate that saved audio belongs to history.

## Data Model

Extend `TranscriptRecord` and the `transcripts` table with nullable audio metadata:

- `audioFileName: string | null`
- `audioMimeType: string | null`
- `audioByteSize: number | null`

Use a migration that adds nullable columns so existing transcript rows remain valid.

The file name should be generated from the transcript id, for example `<transcriptId>.wav`. The database stores the file name, not an absolute path, so app data directory movement does not corrupt history metadata.

## File Storage

Create an app-managed transcript audio directory under the existing app data location:

```text
<app-data>/transcript-audio/
```

The Electron main process owns all filesystem access for saved audio. The renderer must not receive arbitrary filesystem paths for direct access. In v1, it asks the main process for audio bytes for a transcript id and plays those bytes through a blob URL.

## Capture Flow

Both normal dictation and settings test dictation should pass through the same audio preservation helper:

1. Dictation captures a temporary WAV file.
2. ASR and post-processing produce a non-empty transcript.
3. Text insertion is attempted.
4. If `historyEnabled && saveTranscriptAudio`, copy the temporary WAV into the transcript audio directory.
5. Insert the transcript row with audio metadata.
6. Clean up the temporary capture.

If audio preservation fails, the transcript should still be stored as text history, but audio metadata should stay null and the failure should be logged. Losing optional audio should not cause the dictation itself to fail after transcription succeeded.

## Retention And Deletion

Transcript and audio retention are identical.

Repository deletion operations must remove associated audio files:

- `deleteById`
- `clear`
- `deleteCreatedBefore`

File deletion is best effort but observable. If a file is already missing, deletion should be treated as successful. If a file cannot be removed, the repository should log enough context to diagnose the orphan while still deleting the transcript row.

The settings page copy for auto-delete should mention that saved audio is removed with transcripts.

## Playback

History rows with non-null audio metadata render a compact player.

Use ElevenLabs UI `audio-player` as the first-choice component because it is built on shadcn/ui and provides:

- `AudioPlayerProvider`
- `AudioPlayerButton`
- `AudioPlayerProgress`
- `AudioPlayerTime`
- `AudioPlayerDuration`
- `AudioPlayerSpeed`

Install through the documented CLI:

```bash
npx @elevenlabs/cli@latest components add audio-player
```

The playback path should be lazy:

1. The history row renders the player affordance only when audio metadata exists.
2. On play or expansion, the renderer requests audio for that transcript id.
3. The main process validates the transcript id, reads the associated WAV file, and returns WAV bytes plus metadata.
4. The renderer creates a blob URL if needed and revokes it when the row unmounts or source changes.

## IPC

Add an IPC endpoint for loading transcript audio by transcript id. The response should include:

- `bytes`
- `mimeType`
- `byteSize`

Returning bytes keeps the renderer isolated from raw filesystem paths and works with blob URLs. If large files become a concern, this can later move to a custom protocol or streamed response.

## Error Handling

- Missing transcript: return a typed not-found error.
- Transcript has no saved audio: return a typed no-audio error.
- Audio file missing on disk: return a typed missing-file error and keep the transcript row unchanged.
- Playback load failure in the renderer: show the transcript row without crashing the history view.
- Audio save failure after transcription: keep text history and log the audio failure.

## Tests

Add focused coverage for:

- Settings schema default and parsing for `saveTranscriptAudio`.
- Migration adds nullable audio metadata columns.
- Transcript repository deletes audio files for single delete, clear, and retention prune.
- Dictation stop path saves WAV metadata when history and audio saving are enabled.
- Dictation stop path does not save audio when history is disabled or audio saving is disabled.
- Settings test dictation uses the same save behavior.
- IPC audio load rejects missing/no-audio cases and returns WAV bytes for saved audio.
- History UI renders the player only when audio metadata exists.

The task is complete only when `pnpm run check` passes.
