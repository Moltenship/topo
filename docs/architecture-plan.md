# Local-First Desktop Dictation Architecture Plan

## High-Level Architecture

```txt
React Renderer
  setup flow
  settings
  history
  overlay UI

Electron Main
  app lifecycle
  tray
  global hotkey orchestration
  window management
  typed IPC
  SQLite ownership
  helper lifecycle
  transcription orchestration

Services
  AudioCaptureService
  HotkeyService
  ModelManager
  InsertionService
  HistoryService
  PostProcessingService

AI SDK Transcription Layer
  local transcription provider
  WhisperKit model adapter
  whisper.cpp model adapter
  Parakeet model adapter

Native/Runtime Helpers
  macOS WhisperKit helper
  Windows whisper.cpp helper
  Windows Parakeet helper pack
```

The renderer never talks directly to native helpers or SQLite. It talks to Electron Main through typed IPC.

## Tech Stack

- Electron.
- React.
- TypeScript 7 line through `tsgo` / `@typescript/native-preview@beta` where practical.
- Vite.
- TanStack Router.
- shadcn/ui.
- ElevenLabs-style waveform components.
- AI SDK v6 transcription API.
- Effect TS as a core application dependency for typed errors, services, configuration, and async workflows.
- pnpm workspaces.
- OxLint.
- OxFormat.
- Drizzle ORM.
- SQLite.

TypeScript 7 is currently a beta/native toolchain. The repo should target it, but keep an explicit compatibility fallback if Electron, Vite, or library tooling requires the classic TypeScript package in specific scripts.

## Monorepo Layout

```txt
apps/
  desktop/
    electron/
    renderer/
    resources/

packages/
  ui/
  shared/
  db/
  model-catalog/
  asr/
  native-bridge/
  audio/
  settings/
```

Suggested package responsibilities:

```txt
packages/ui
  shared React components
  shadcn wrappers
  waveform components

packages/shared
  shared types
  Effect-based result/error helpers
  platform constants
  shared configuration schemas

packages/db
  Drizzle schema
  migrations
  repositories

packages/model-catalog
  static bundled model catalog
  hardware recommendation policy
  model eligibility checks

packages/asr
  AI SDK local transcription provider
  transcription model adapters
  transcript result normalization
  Effect services for model/runtime dependencies

packages/native-bridge
  helper process lifecycle
  JSON-RPC client
  transport abstraction
  Effect-managed helper resources

packages/audio
  audio capture interfaces
  Web Audio MVP implementation
  waveform level events

packages/settings
  settings schema
  default values
  validation
```

## Effect TS Usage

Effect is a core dependency for the TypeScript application layer.

Use Effect for:

- typed domain errors;
- service boundaries and dependency injection;
- configuration loading and validation;
- helper process lifecycle resources;
- model download, verification, and install workflows;
- transcription orchestration;
- retry, timeout, cancellation, and cleanup behavior.

Avoid using Effect as a renderer UI state library. React UI state should stay in React/TanStack patterns, while Effect owns application workflows and infrastructure services behind typed IPC and service APIs.

## Routing

Use TanStack Router with file-based routes.

Primary routes:

```txt
/
/setup/welcome
/setup/hotkey
/setup/models
/setup/download
/setup/permissions
/setup/test
/setup/done
/history
/settings
/settings/models
/settings/hotkey
/settings/audio
/settings/privacy
```

Router context should expose typed renderer-side API clients, not raw Electron primitives.

## Renderer Boundaries

Renderer responsibilities:

- Render setup, settings, history, and overlay UI.
- Display model cards and download status.
- Display recording and processing state.
- Let the user choose settings.
- Call typed IPC clients.

Renderer must not:

- Open SQLite directly.
- Spawn helper processes.
- Access model files directly.
- Own transcription orchestration.

## Electron Main Responsibilities

Electron Main owns all privileged and platform-sensitive operations:

- App lifecycle.
- Tray and background mode.
- Main/settings/history windows.
- Transparent overlay window.
- Native/global hotkey integration.
- Audio capture orchestration.
- Model installation and validation.
- Helper process lifecycle.
- SQLite connection and migrations.
- Text insertion.
- IPC API.

## Overlay Window

The overlay is a separate Electron BrowserWindow.

Configuration:

```txt
transparent: true
frame: false
alwaysOnTop: true
focusable: false
skipTaskbar: true
resizable: false
```

The overlay receives state from Electron Main and renders:

- recording waveform;
- processing status;
- inserted success state;
- error state.

It must not steal focus from the user's active app.

## Audio Capture

Use a service boundary:

```ts
interface AudioCaptureService {
  startRecording(sessionId: string): Promise<void>
  stopRecording(reason: StopReason): Promise<CapturedAudio>
  onLevelFrame(listener: (frame: LevelFrame) => void): Unsubscribe
}
```

MVP implementation:

- Web Audio / MediaRecorder / AudioWorklet.
- Waveform level frames emitted to overlay.
- Output written as a temporary audio file for transcription.

Future implementation:

- Native helper capture can replace the implementation without changing UI or ASR contracts.

## Hotkey Service

True hold-to-talk requires key down and key up semantics.

```ts
interface HotkeyService {
  bind(binding: HotkeyBinding): Promise<void>
  unbind(): Promise<void>
  onPressed(listener: () => void): Unsubscribe
  onReleased(listener: () => void): Unsubscribe
}
```

Electron `globalShortcut` is not enough for ideal hold behavior. Use native/global key listener integration:

- macOS: likely Accessibility/Input Monitoring permissions.
- Windows: low-level keyboard hook/helper.

Caps Lock is recommended but not suppressed in MVP.

## Transcription With AI SDK

Use AI SDK v6 `experimental_transcribe` as the orchestration API for transcription.

Electron Main calls:

```ts
experimental_transcribe({
  model: localAsr.transcription(selectedModelId),
  audio,
  abortSignal,
})
```

`packages/asr` provides a local AI SDK transcription provider that maps selected model IDs to local helper-backed transcription models.

The provider normalizes helper results into the AI SDK transcription shape:

```txt
text
segments
language
durationInSeconds
warnings
```

Risk:

- The AI SDK transcription API is experimental. Keep the provider wrapper as the only integration point so API changes are isolated.

## Helper Processes

Helpers are long-running processes. They keep models loaded in memory to reduce dictation latency.

### macOS WhisperKit Helper

- Implemented in Swift.
- Long-running process.
- Loads selected WhisperKit model.
- Receives transcription jobs.
- Returns normalized transcript results.

### Windows whisper.cpp Helper

- Long-running process.
- Wraps whisper.cpp.
- Supports CPU and CUDA-capable builds where feasible.
- Keeps selected model loaded.
- Receives transcription jobs.

### Windows Parakeet Helper

- Experimental downloadable runtime pack.
- Not required for the default Windows path.
- Uses the same helper protocol.

## Helper Protocol

Transport:

- JSON-RPC over stdin/stdout.

Rules:

- `stdout` is only JSON-RPC.
- `stderr` is logs.
- Audio is passed by file path, not streamed as binary data.
- Large binary payloads are not sent over JSON-RPC.

Example messages:

```json
{ "id": "1", "method": "health" }
{ "id": "2", "method": "loadModel", "params": { "modelId": "whisperkit-large-v3-turbo" } }
{ "id": "3", "method": "transcribe", "params": { "audioPath": "...", "language": "ru" } }
{ "id": "4", "method": "unloadModel" }
```

Transport abstraction:

```txt
HelperTransport
  StdioTransport now
  PipeTransport later
  SocketTransport later
```

## Model Catalog

Use a static bundled catalog in MVP.

Catalog entries include:

```txt
id
displayName
runtime
platforms
architectures
languages
downloadUrl
checksum
downloadSizeBytes
diskSizeBytes
estimatedMemoryBytes
qualityLabel
speedLabel
badges
experimental
```

No remote manifest in MVP.

## Model Manager

Responsibilities:

- Evaluate hardware eligibility.
- Recommend a model.
- Download model artifacts.
- Verify checksum.
- Track installed models.
- Change active model.
- Delete models.
- Move model storage.
- Repair downloads.

Runtime packaging:

- WhisperKit helper bundled on macOS.
- whisper.cpp helper bundled on Windows.
- Parakeet runtime pack downloadable and experimental.

## SQLite And Drizzle

Electron Main owns the SQLite connection.

Use Drizzle ORM for schema and migrations.

Initial tables:

```txt
settings
installed_models
dictation_sessions
transcripts
insertion_events
download_events
permission_state
app_events
```

History tables store text and metadata only. Audio is temporary and deleted after transcription.

Renderer accesses data through typed IPC APIs.

## Insertion Service

Insertion modes:

```txt
paste
typing
hybrid
```

Default:

- paste via clipboard with clipboard restore where possible.

The insertion service records insertion events for history and debugging.

## Post-Processing Service

Pipeline:

```txt
Raw transcript
  -> TranscriptNormalizer
  -> optional future local AI action
  -> inserted text
```

MVP modes:

- raw;
- lightweight normalization.

Default:

- lightweight normalization.

Future local AI actions can use AI SDK language model APIs, but they must remain opt-in and local-first unless product policy changes.

## Error Handling

Errors should be mapped into user-readable categories:

```txt
microphone_permission_denied
hotkey_permission_denied
input_permission_denied
model_not_installed
model_load_failed
transcription_failed
insertion_failed
helper_unavailable
download_failed
checksum_failed
```

Detailed helper logs go to local logs, not directly to the overlay.

Internally, domain and infrastructure failures should be represented as typed Effect errors before they are mapped to IPC-safe error payloads and user-readable messages.

## Testing Strategy

Unit tests:

- model recommendation policy;
- catalog validation;
- settings validation;
- transcript normalization;
- JSON-RPC message parsing;
- Drizzle repositories.

Integration tests:

- helper lifecycle with mock helper;
- transcription provider with mock helper;
- model install state transitions;
- history write/read/delete.

Manual desktop tests:

- macOS permissions.
- Windows permissions/hooks.
- overlay focus behavior.
- insertion into common apps.
- Caps Lock behavior.
- English and Russian dictation.

## Key Risks

- AI SDK transcription API is experimental.
- TypeScript 7 native toolchain may not be fully compatible with every tool.
- macOS and Windows global key hooks require careful permission handling.
- Transparent focusless overlay behavior can be platform-sensitive.
- whisper.cpp long-running helper needs custom lifecycle work.
- Parakeet packaging on Windows may be heavier than the default Whisper path.
