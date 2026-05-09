# Local-First Desktop Dictation Product Plan

## Product Goal

Build a local-first desktop dictation app for macOS and Windows. The user holds a configurable hotkey, speaks, sees a polished bottom-center waveform overlay, then the app transcribes locally and inserts the text into the currently focused input.

The product should feel like a system layer rather than a document editor: always available, fast, private, and visually calm.

## MVP Scope

- macOS and Windows desktop app built with Electron.
- English and Russian transcription.
- Local-first transcription after model installation.
- No bundled models in the installer.
- First-run setup flow downloads a selected model.
- Model memory/disk target: approximately 3 GB or less.
- True hold-to-talk behavior through native/global key listening.
- Transparent overlay inspired by Wispr Flow and ElevenLabs-style waveform UI, with a
  configurable screen position.
- Text insertion into the active focused input.
- Local transcript history with search, copy, reinsert, delete, and clear-all.
- SQLite-backed local state and history.

## Out Of Scope For MVP

- Cloud transcription.
- Intel/OpenVINO-specific model path.
- NVIDIA Riva, NIM, Canary, or enterprise NVIDIA serving stacks.
- Remote model manifest.
- Audio recording history.
- Caps Lock suppression.
- Native overlay rendering.
- Streaming partial transcription.
- Local LLM cleanup beyond lightweight text normalization.

## Local-First Policy

The app is local-first by default and by design.

- Core dictation must work fully offline after model installation.
- No audio or transcript text is sent to cloud providers in MVP.
- AI SDK is used as an internal transcription/provider abstraction, not as a reason to send data externally.
- Effect TS is a core application dependency for reliable local workflows, typed failures, and service boundaries.
- Future cloud features, if added, must be explicit opt-in and separate from the default local dictation flow.

## First-Run Setup Flow

Setup is a guided flow with a full model picker step.

Routes:

```txt
/setup/welcome
/setup/hotkey
/setup/models
/setup/download
/setup/permissions
/setup/test
/setup/done
```

Flow:

1. Welcome: present private offline dictation.
2. Hotkey: user chooses a hold-to-talk key.
3. Models: hardware-aware recommendation plus manual choice.
4. Download: fetch the selected model and required runtime pack if needed.
5. Permissions: request permissions contextually.
6. Test: user tries a short dictation.
7. Done: app moves into tray/background mode.

Permissions are split:

- Explain required permissions early.
- Request microphone permission before test recording.
- Request accessibility/input permissions before hotkey or insertion tests.

## Hotkey UX

The app supports true hold-to-talk.

- Hotkey down starts recording.
- Hotkey up stops recording.
- Key repeat is ignored.
- The hotkey is configurable in setup and settings.
- Recommended first-run option: Caps Lock.
- Caps Lock is not suppressed in MVP, so the system Caps Lock behavior remains active.
- The setup UI warns that Caps Lock may toggle capitalization.

Recording modes:

```txt
Toggle-to-talk:
  first hotkey press = start
  second hotkey press = stop

Push-to-talk:
  start = hotkey down
  stop = hotkey up

Smart dictation:
  start = hotkey down
  stop = hotkey up OR silence timeout
```

Default:

- Toggle-to-talk until native key down/up hooks are available.
- Silence timeout disabled.

Configurable silence timeout options:

- 1.2s
- 1.5s
- 2.0s
- 3.0s

## Overlay UX

The overlay is a separate transparent Electron window. It defaults to bottom-center, similar to
Wispr Flow, and can be repositioned from settings.

States:

```txt
hidden
recording
processing
inserted
error
```

Recording state:

- Compact bottom-center bar.
- Live waveform inspired by ElevenLabs UI.
- Clear recording affordance.

Processing state:

- Shows that transcription is running.
- Keeps the current input focused by not stealing focus.

Completion state:

- Brief success state after insertion.
- Fade out.

Error state:

- Short user-readable error.
- Does not expose low-level helper logs in the overlay.

Position settings:

- The user can choose where the overlay appears.
- Settings expose an overlay position picker.
- Pressing the position action shows a live preview pill.
- The user can move or choose the preferred screen area while the preview is visible.
- The selected position is saved locally and reused for future recordings.
- MVP presets should include bottom-center, top-center, bottom-left, bottom-right, center-left,
  and center-right.

## Model Selection

The setup model picker uses a static bundled model catalog in MVP.

The hardware scan determines eligible and recommended models, but the user explicitly confirms or chooses another model.

Model card fields:

- Name.
- Runtime.
- Languages.
- Approximate download size.
- Approximate disk usage.
- Approximate memory usage.
- Speed.
- Accuracy.
- Recommended/fastest/best quality/experimental badges.
- Availability reason if disabled.

MVP model families:

### macOS Apple Silicon

Runtime: WhisperKit.

Models:

- Tiny.
- Base.
- Small.
- Large V3 Turbo, if it fits the app's size/memory target.
- Distil Large V3, if supported cleanly by the WhisperKit path.

### Windows

Runtime: whisper.cpp.

Models:

- Whisper small/base variants for speed.
- Whisper large-v3-turbo or comparable high-quality model if within the size/memory target.

### Windows NVIDIA Experimental

Runtime: Parakeet helper pack.

Model:

- NVIDIA Parakeet TDT 0.6B v3 or equivalent multilingual Parakeet model supporting English and Russian.

Parakeet is shown as advanced/experimental until integration is proven stable in the desktop packaging flow.

## Model Storage

Default storage:

- macOS: Application Support app directory.
- Windows: AppData app directory.

Settings allow changing the model directory.

Move behavior:

- Check free space.
- Copy model files.
- Validate checksums.
- Switch active path.
- Delete old files only after successful validation.

Installed model management:

- View installed models.
- Delete model.
- Redownload or repair model.
- Change active model.

## Text Insertion

Insertion is user-selectable.

Modes:

```txt
Paste:
  Put transcript into clipboard, paste, then restore previous clipboard where possible.

Typing:
  Simulate keystrokes.

Hybrid:
  Try paste first, fallback to typing.
```

Default:

- Paste via clipboard with clipboard restore.

## Transcript History

History is enabled by default.

Stored:

- Transcript text.
- Timestamp.
- Duration.
- Model.
- Runtime.
- Language.
- Recording mode.
- Stop reason.
- Insertion mode.
- Insertion status.
- Target app name if available.

Not stored:

- Audio recordings.

Audio files are temporary and deleted after transcription succeeds or fails.

History MVP UI:

```txt
/history
  search transcripts
  copy transcript
  reinsert transcript into active input
  delete one transcript
  clear all history
```

Privacy controls:

- Toggle history.
- Clear history.
- Auto-delete after a configured period.

## Text Post-Processing

Post-processing is user-selectable.

MVP options:

```txt
Raw:
  Insert transcript exactly as returned by the model.

Lightweight normalization:
  trim
  collapse whitespace
  strip whisper.cpp segment timestamps
  normalize punctuation spacing
  collapse repeated punctuation
  drop common no-speech hallucinations
  capitalize standalone English "i"
  optional first-letter capitalization
```

Default:

- Lightweight normalization.

Future local AI actions may include cleanup, formatting, translation, and command mode, but they are not part of the core MVP.

## Success Criteria

- A new user can complete setup and run a first dictation without reading documentation.
- Dictation works offline after model installation.
- Holding the configured key records audio and releasing it inserts text into the active app.
- The overlay appears immediately and does not steal focus.
- English and Russian are supported.
- The app keeps local searchable transcript history without retaining audio.
- The model layer can support WhisperKit, whisper.cpp, and Parakeet without changing the renderer UI.
