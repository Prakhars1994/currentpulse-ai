const CLEARLY_NON_PUBLIC_PATTERNS = [
  /\bcall for papers\b/i,
  /\bconference registration\b/i,
  /\bwebinar registration\b/i,
  /\bsubmit (?:a )?pitch\b/i,
  /\bhow to pitch\b/i,
  /\beditorial guidelines?\b/i,
  /\brepublication guidelines?\b/i,
  /\bnewsletter sign[- ]?up\b/i,
  /\bjoin our newsletter\b/i,
  /\bjob vacancy\b/i,
  /\bvacancies\b/i,
  /\bpostdoctoral (?:position|fellowship)\b/i,
  /\bphd (?:position|vacancy|scholarship)\b/i,
  /\bacademic workshop\b/i,
];

function clean(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function isGeneralPublicConversationItem(item = {}) {
  const title = clean(item.title);
  const description = clean(item.description);
  if (!title || title.length < 8) return false;
  const combined = `${title} ${description}`;
  return !CLEARLY_NON_PUBLIC_PATTERNS.some((pattern) =>
    pattern.test(combined)
  );
}
