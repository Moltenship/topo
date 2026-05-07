export type PostProcessingMode = "raw" | "lightweight";

export const normalizeTranscript = (text: string, mode: PostProcessingMode): string => {
  if (mode === "raw") {
    return text;
  }

  const normalized = text
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1");

  if (normalized.length === 0) {
    return normalized;
  }

  return normalized.charAt(0).toLocaleUpperCase() + normalized.slice(1);
};
