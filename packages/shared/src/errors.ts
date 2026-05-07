export type UserErrorCode =
  | "microphone_permission_denied"
  | "hotkey_permission_denied"
  | "input_permission_denied"
  | "model_not_installed"
  | "model_load_failed"
  | "transcription_failed"
  | "insertion_failed"
  | "helper_unavailable"
  | "download_failed"
  | "checksum_failed";

export interface UserFacingError {
  readonly code: UserErrorCode;
  readonly message: string;
}
