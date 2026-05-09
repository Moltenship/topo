export type PostProcessingMode = "raw" | "lightweight";

export const normalizeTranscript = (text: string, mode: PostProcessingMode): string => {
  if (mode === "raw") {
    return text;
  }

  const normalized = text
    .replace(/\[\d{2}:\d{2}:\d{2}\.\d{3}\s+-->\s+\d{2}:\d{2}:\d{2}\.\d{3}\]/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/([,.!?;:])\1+/g, "$1")
    .replace(/\s+([,.!?;:])/g, "$1");

  if (isNoSpeechHallucination(normalized)) {
    return "";
  }

  return capitalizeFirstLetter(capitalizeStandaloneEnglishI(normalized));
};

const isNoSpeechHallucination = (text: string): boolean =>
  /^(\[blank_audio\]|\(blank_audio\)|blank_audio|you|thank you|thanks|okay|ok)[.!?]?$/i.test(text);

const capitalizeFirstLetter = (text: string): string => {
  if (text.length === 0) {
    return text;
  }

  return text.charAt(0).toLocaleUpperCase() + text.slice(1);
};

const capitalizeStandaloneEnglishI = (text: string): string => text.replace(/\bi\b/g, "I");
