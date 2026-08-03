const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "been", "being", "by",
  "for", "from", "has", "have", "had", "in", "into", "is", "it", "its",
  "of", "on", "or", "that", "the", "their", "this", "to", "was", "were",
  "will", "with", "after", "amid", "over", "says", "said", "new", "latest",
  "india", "indian", "news", "current", "affairs", "update", "updates",
]);

const ENTITY_DICTIONARY = [
  "supreme court", "high court", "parliament", "rajya sabha", "lok sabha",
  "prime minister", "union cabinet", "rbi", "sebi", "election commission",
  "isro", "drdo", "imf", "world bank", "world health organization",
  "united nations", "g20", "brics", "niti aayog", "upsc", "gst council",
];

export function normalizeText(text = "") {
  return String(text || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(text = "") {
  return new Set(
    normalizeText(text)
      .split(" ")
      .filter((word) => word.length > 2 && !STOP_WORDS.has(word))
  );
}

function overlap(first, second) {
  if (!first.size || !second.size) {
    return { common: 0, containment: 0, jaccard: 0 };
  }

  let common = 0;
  for (const value of first) {
    if (second.has(value)) common += 1;
  }

  return {
    common,
    containment: common / Math.min(first.size, second.size),
    jaccard: common / (first.size + second.size - common),
  };
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysApart(first, second) {
  const firstDate = parseDate(first);
  const secondDate = parseDate(second);
  if (!firstDate || !secondDate) return null;
  return Math.abs(firstDate.getTime() - secondDate.getTime()) / 86400000;
}

export function extractEntities(article = {}) {
  const text = normalizeText(`${article.title || ""} ${article.description || ""}`);
  return ENTITY_DICTIONARY.filter((entity) => text.includes(entity));
}

export function extractKeywords(article = {}) {
  return [...tokenSet(`${article.title || ""} ${article.description || ""}`)];
}

export function generateEventFingerprint(article = {}) {
  return {
    normalizedTitle: normalizeText(article.title),
    titleKeywords: tokenSet(article.title),
    contextKeywords: tokenSet(`${article.title || ""} ${article.description || ""}`),
    entities: new Set(extractEntities(article)),
    publishedAt: article.pubDate || article.publishedAt || article.published_at || null,
  };
}

/**
 * Event-level duplicate detection for a single news cycle.
 * A development on a later date stays eligible even when it concerns the same topic.
 */
export function isSameEvent(articleA = {}, articleB = {}) {
  const first = generateEventFingerprint(articleA);
  const second = generateEventFingerprint(articleB);
  const dateDistance = daysApart(first.publishedAt, second.publishedAt);

  if (dateDistance !== null && dateDistance > 2) {
    return false;
  }

  if (
    first.normalizedTitle &&
    first.normalizedTitle === second.normalizedTitle
  ) {
    return true;
  }

  const title = overlap(first.titleKeywords, second.titleKeywords);
  const context = overlap(first.contextKeywords, second.contextKeywords);
  const entities = overlap(first.entities, second.entities);

  if (title.common >= 4 && title.containment >= 0.72 && title.jaccard >= 0.46) {
    return true;
  }

  if (title.common >= 3 && title.containment >= 0.86) {
    return true;
  }

  if (
    entities.common > 0 &&
    title.common >= 3 &&
    title.containment >= 0.62 &&
    context.containment >= 0.44
  ) {
    return true;
  }

  return false;
}
