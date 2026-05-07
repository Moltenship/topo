export const IpcChannels = {
  getAppState: "app:get-state",
  listTranscripts: "history:list-transcripts",
  deleteTranscript: "history:delete-transcript",
  clearTranscripts: "history:clear-transcripts",
  updateSettings: "settings:update",
  startTestDictation: "dictation:start-test",
  stopTestDictation: "dictation:stop-test",
} as const;

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels];
