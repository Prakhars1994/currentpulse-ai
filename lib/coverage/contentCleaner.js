function cleanText(value) {
  return typeof value === "string"
    ? value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim()
    : "";
}

const NOISE_PATTERNS = [
  /\bPrev\s+Next\b/gi,
  /\bPrevious\s+Next\b/gi,
  /\bPrint PDF\b/gi,
  /\bPrint This Article\b/gi,
  /\bShare This Article\b/gi,
  /\bDownload PDF\b/gi,
  /\bRead More\s*:?/gi,
  /\bRead more\s*:?/gi,
  /\bTags\s*:?/gi,
  /\bSource\s*:?\s*(?=[A-Z])/g,
];

export function cleanTrustedCoverageText(value) {
  let text = cleanText(value);

  for (const pattern of NOISE_PATTERNS) {
    text = text.replace(pattern, " ");
  }

  return text
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([.!?])(?=[A-Z])/g, "$1 ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function extractPublishedDateFromText(value) {
  const text = cleanText(value);
  const match = text.match(
    /\b(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(20\d{2})\b/i
  );

  if (!match) return null;

  const date = new Date(`${match[1]} ${match[2]} ${match[3]} 00:00:00 UTC`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function isUsefulArticleImage(url) {
  const value = cleanText(url).toLowerCase();
  if (!value) return false;

  return !(
    value.includes("logo") ||
    value.includes("favicon") ||
    value.includes("icon") ||
    value.includes("avatar")
  );
}
