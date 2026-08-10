const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "been", "being", "by",
  "for", "from", "has", "have", "had", "in", "into", "is", "it", "its",
  "of", "on", "or", "that", "the", "their", "this", "to", "was", "were",
  "will", "with", "after", "amid", "over", "says", "said", "new", "latest",
  "india", "indian", "news", "current", "affairs", "update", "updates",
  "today", "report", "reports", "announces", "announced", "launches", "launched",
]);

const ENTITY_DICTIONARY = [
  "supreme court", "high court", "parliament", "rajya sabha", "lok sabha",
  "prime minister", "union cabinet", "rbi", "sebi", "election commission",
  "isro", "drdo", "imf", "world bank", "world health organization",
  "united nations", "g20", "brics", "niti aayog", "upsc", "gst council",
  "ministry of finance", "ministry of environment", "ministry of defence",
];

const ACTION_EQUIVALENTS = new Map([
  ["launch", "launch"], ["launches", "launch"], ["launched", "launch"],
  ["approve", "approve"], ["approves", "approve"], ["approved", "approve"],
  ["pass", "pass"], ["passes", "pass"], ["passed", "pass"],
  ["sign", "sign"], ["signs", "sign"], ["signed", "sign"],
  ["announce", "announce"], ["announces", "announce"], ["announced", "announce"],
  ["rule", "rule"], ["rules", "rule"], ["ruled", "rule"], ["ruling", "rule"],
  ["reject", "reject"], ["rejects", "reject"], ["rejected", "reject"],
  ["issue", "issue"], ["issues", "issue"], ["issued", "issue"],
  ["tender", "tender"], ["tenders", "tender"], ["procurement", "tender"],
  ["establish", "establish"], ["established", "establish"], ["establishment", "establish"],
  ["tries", "attempt"], ["try", "attempt"], ["attempts", "attempt"], ["attempted", "attempt"],
  ["restrict", "limit"], ["restricts", "limit"], ["restricted", "limit"], ["limiting", "limit"],
  ["plastic", "polymer"],
  ["financial", "fiscal"],
  ["beginning", "start"], ["begins", "start"], ["begin", "start"], ["starting", "start"],
]);

export function normalizeText(text = "") {
  return String(text || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(?:19|20)\d{2}\b/g, " ")
    .replace(/\b(?:today|yesterday|tomorrow)\b/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stemToken(word = "") {
  const mapped = ACTION_EQUIVALENTS.get(word);
  if (mapped) return mapped;
  if (word.length > 5 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.length > 5 && word.endsWith("ing")) return word.slice(0, -3);
  if (word.length > 4 && word.endsWith("ed")) return word.slice(0, -2);
  if (word.length > 4 && word.endsWith("s")) return word.slice(0, -1);
  return word;
}

function tokenSet(text = "") {
  return new Set(
    normalizeText(text)
      .split(" ")
      .map(stemToken)
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

function coreTitleTokens(article = {}) {
  return [...tokenSet(article.title || "")]
    .filter((token) => !/^\d+$/.test(token))
    .sort();
}

/**
 * Stable event key used for queue/source bookkeeping. It intentionally ignores
 * dates and common newsroom verbs so the same announcement from another feed
 * does not become a new article just because the headline was rewritten.
 */
export function generateEventKey(article = {}) {
  const tokens = coreTitleTokens(article).slice(0, 14);
  const entities = extractEntities(article).map((value) => value.replace(/\s+/g, "_"));
  return [...new Set([...entities, ...tokens])].slice(0, 16).join("|");
}

export function generateEventFingerprint(article = {}) {
  return {
    normalizedTitle: normalizeText(article.title),
    titleKeywords: tokenSet(article.title),
    contextKeywords: tokenSet(`${article.title || ""} ${article.description || ""}`),
    entities: new Set(extractEntities(article)),
    eventKey: generateEventKey(article),
    publishedAt: article.pubDate || article.publishedAt || article.published_at || null,
  };
}

/**
 * Event-level duplicate detection. Exact/core-title duplicates are rejected
 * regardless of feed date. The date window is used only for fuzzy matches, so
 * a genuine later development on the same broad topic can still be published.
 */
export function isSameEvent(articleA = {}, articleB = {}) {
  const first = generateEventFingerprint(articleA);
  const second = generateEventFingerprint(articleB);

  if (first.normalizedTitle && first.normalizedTitle === second.normalizedTitle) {
    return true;
  }

  if (first.eventKey && second.eventKey && first.eventKey === second.eventKey) {
    return true;
  }

  const title = overlap(first.titleKeywords, second.titleKeywords);
  const context = overlap(first.contextKeywords, second.contextKeywords);
  const entities = overlap(first.entities, second.entities);

  // Strong headline similarity is considered the same event even if one feed
  // is several days late.
  if (title.common >= 5 && title.containment >= 0.78 && title.jaccard >= 0.52) {
    return true;
  }
  if (title.common >= 4 && title.containment >= 0.9) {
    return true;
  }

  const dateDistance = daysApart(first.publishedAt, second.publishedAt);
  if (dateDistance !== null && dateDistance > 3) {
    return false;
  }

  // Rewritten headlines often retain the named institution plus four core
  // subject terms while changing every verb (for example "restrict"/"limit"
  // or "plastic"/"polymer"). Within one news cycle this is the same event,
  // but the entity requirement prevents unrelated RBI/SC stories collapsing.
  if (
    entities.common > 0 &&
    title.common >= 4 &&
    title.jaccard >= 0.34
  ) {
    return true;
  }

  if (title.common >= 4 && title.containment >= 0.68 && title.jaccard >= 0.42) {
    return true;
  }

  if (title.common >= 3 && title.containment >= 0.88) {
    return true;
  }

  if (
    entities.common > 0 &&
    title.common >= 3 &&
    title.containment >= 0.6 &&
    context.containment >= 0.42
  ) {
    return true;
  }

  return false;
}
