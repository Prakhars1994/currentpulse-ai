// lib/news/eventCluster.js

/**
 * Normalize text for comparison
 */
export function normalizeText(text = "") {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Small stop-word list
 * (can be expanded later)
 */
const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "of",
  "for",
  "to",
  "in",
  "on",
  "at",
  "and",
  "or",
  "with",
  "from",
  "by",
  "is",
  "are",
  "was",
  "were",
  "has",
  "have",
  "had",
]);

/**
 * Important entities
 * Expand gradually as needed.
 */
const ENTITY_DICTIONARY = [
  "supreme court",
  "high court",
  "parliament",
  "rajya sabha",
  "lok sabha",
  "president",
  "prime minister",
  "cabinet",
  "rbi",
  "sebi",
  "eci",
  "election commission",
  "isro",
  "drdo",
  "imf",
  "world bank",
  "who",
  "un",
  "g20",
  "brics",
  "niti aayog",
  "upsc",
  "cbi",
  "ed",
  "gst council"
];

/**
 * Extract known entities
 */
export function extractEntities(article) {
  const text = normalizeText(
    `${article.title || ""} ${article.description || ""}`
  );

  return ENTITY_DICTIONARY.filter(entity =>
    text.includes(entity)
  );
}

/**
 * Extract useful keywords
 */
export function extractKeywords(article) {
  const text = normalizeText(
    `${article.title || ""} ${article.description || ""}`
  );

  return [...new Set(
    text
      .split(" ")
      .filter(word =>
        word.length > 3 &&
        !STOP_WORDS.has(word)
      )
  )];
}

/**
 * Event fingerprint
 */
export function generateEventFingerprint(article) {

  return {
    entities: extractEntities(article),
    keywords: extractKeywords(article),
    publishedAt: article.pubDate || article.publishedAt || null
  };

}

/**
 * Placeholder.
 * We will make this intelligent next.
 */
export function isSameEvent(articleA, articleB) {

  const eventA = generateEventFingerprint(articleA);
  const eventB = generateEventFingerprint(articleB);

  // Same publication date/news cycle
  if (
    eventA.publishedAt &&
    eventB.publishedAt &&
    eventA.publishedAt.slice(0, 10) !== eventB.publishedAt.slice(0, 10)
  ) {
    return false;
  }

  // Entity overlap
  const commonEntities = eventA.entities.filter(entity =>
    eventB.entities.includes(entity)
  );

  // Keyword overlap
  const commonKeywords = eventA.keywords.filter(keyword =>
    eventB.keywords.includes(keyword)
  );

  // Similarity scores
  const entityScore =
    commonEntities.length /
    Math.max(eventA.entities.length, eventB.entities.length, 1);

  const keywordScore =
    commonKeywords.length /
    Math.max(eventA.keywords.length, eventB.keywords.length, 1);

  return (
    entityScore >= 0.6 &&
    keywordScore >= 0.5
  );

}