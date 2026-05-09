# Real Dictation Runtime Design

## Goal

Turn the existing test dictation flow into a real vertical slice for Windows `whisper.cpp`: record microphone audio, transcribe with the installed model, save a text transcript, and show accurate readiness in Settings.

## Current State

- The app already downloads and verifies model files.
- `whisper-cpp-small` is installed under the app-managed model directory.
- The installed model record stores the model file path.
- The renderer already has `Test dictation`, overlay state, settings, and transcript history.
- Main process currently wires mock audio capture and mock transcription.
- The app does not yet install, discover, or validate the `whisper.cpp` executable.

## Readiness Model

Model installation and model readiness are separate states.

- `installed`: the model artifact exists, matches size/checksum, and is recorded in the local database.
- `runtime available`: a compatible `whisper.cpp` executable can be resolved.
- `runtime verified`: the executable starts successfully and reports usable CLI behavior, for example through a version/help probe.
- `ready`: installed model plus runtime verified.

Settings must show the green readiness indicator only for `ready`. A model with a valid `.bin` file but missing runtime binary should show a non-green warning state such as `Runtime missing`.

## Binary Resolver

Add a `whisper.cpp` runtime resolver in the Electron main layer. It resolves candidates in this order:

1. User or dev override from settings or environment, for example `MOLTEN_WHISPER_CPP_BINARY`.
2. App-bundled resource path, for example `resources/whisper.cpp/whisper-cli.exe`.
3. PATH candidates: `whisper-cli`, `whisper-cli.exe`, `whisper.cpp`, `whisper.cpp.exe`, `main`, `main.exe`.

The resolver returns a typed result:

- `available`: absolute binary path, source, version/help probe output, and timestamp.
- `missing`: checked candidates and user-facing remediation text.
- `failed`: resolved path exists but cannot run or exits unexpectedly.

The resolver should cache the last successful result during the app session, but Settings needs a refresh action or app-state refresh so the user can install a binary and see readiness update without reinstalling the model.

## Runtime Verification

Verification should be cheap and non-destructive:

- Spawn the candidate with a help/version-style command.
- Use a short timeout.
- Capture stdout/stderr.
- Treat known successful exit codes/output as verified.
- Never run transcription as part of the basic readiness check.

For `whisper.cpp`, the implementation should support modern `whisper-cli` first. Older `main.exe` can be supported as a compatibility candidate if its command shape is confirmed locally.

## Transcription Provider

Add a real `WhisperCppTranscriptionProvider` behind the existing `TranscriptionProvider` interface.

Inputs:

- captured audio file path;
- active model id;
- language setting;
- installed model path from the database;
- resolved runtime binary path.

Behavior:

- Fail with `model_not_installed` if the active model has no verified installed record.
- Fail with `runtime_missing` if no binary is available.
- Spawn `whisper.cpp` with the installed model and temp audio file.
- Prefer machine-readable output if supported by the binary.
- Normalize the final text into the existing `TranscriptionResult`.
- Preserve stderr/stdout details for local logs, but expose concise user-facing errors to overlay/settings.

## Audio Capture

Replace mock audio capture with a real temp `.wav` capture service for the test dictation flow.

Requirements:

- Store audio under the app temp directory.
- Delete captured audio after transcription succeeds or fails.
- Emit level frames for the overlay waveform.
- Keep the service isolated behind `AudioCaptureService` so future native capture can replace the first implementation.

If direct microphone capture is risky for the first implementation, a narrow Windows-first helper can be introduced, but the public TypeScript interface should stay unchanged.

## UI Behavior

Settings model rows should distinguish:

- `Not installed`
- `Installed, runtime missing`
- `Installed, runtime failed`
- `Ready`
- `Update available` later, when manifest/version work exists

Only `Ready` gets the green lamp. `Installed` alone must not look ready.

`Test dictation` should be enabled only when the active model is ready. If the user tries to run it while not ready, the app should show the exact missing piece instead of silently falling back to mocks.

Overlay states for this slice:

- `recording`: audio capture active, waveform visible.
- `processing`: recording stopped, transcription running.
- `inserted` or `done`: transcript saved.
- `error`: concise reason such as missing runtime, missing model, capture failure, or transcription failure.

## Data Flow

1. Renderer starts test dictation.
2. Main starts real audio capture and publishes `recording`.
3. Renderer stops test dictation.
4. Main publishes `processing`.
5. Main resolves active model installed path.
6. Main resolves and verifies `whisper.cpp` runtime.
7. ASR provider transcribes the temp audio.
8. Orchestrator normalizes the text and deletes audio.
9. Main saves transcript when history is enabled.
10. Renderer updates history and readiness state from app snapshot.

## Testing

Unit tests:

- binary resolver candidate ordering;
- resolver missing and failed states;
- readiness computation from installed model plus runtime status;
- transcription provider command construction;
- transcription provider output parsing;
- audio cleanup on success and failure.

Integration tests:

- test dictation with fake audio capture and fake `whisper.cpp` binary;
- app-state readiness shows green only when model and binary are verified.

Manual verification:

- install `whisper-cpp-small`;
- configure or bundle `whisper.cpp` binary;
- run `Test dictation`;
- confirm overlay transitions recording to processing to done;
- confirm transcript appears in local history.

## Out Of Scope

- Global hold-to-talk hotkey.
- Real text insertion into other applications.
- Bundling official `whisper.cpp` releases into installers.
- Streaming partial transcription.
- Parakeet and WhisperKit runtime execution.
