const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "been", "being", "by",
  "for", "from", "has", "have", "had", "in", "into", "is", "it", "its",
  "of", "on", "or", "that", "the", "their", "this", "to", "was", "were",
  "will", "with", "after", "amid", "over", "says", "said", "new", "latest",
  "india", "indian", "news", "current", "affairs", "update", "updates",
  "today", "report", "reports", "announces", "announced", "launches", "launched",
  "status", "statu", "growth", "trend", "trends", "strategic", "implication", "implications",
  "joint", "trilateral", "towards", "overview", "explained",
]);

const ENTITY_DICTIONARY = [
  "supreme court", "high court", "parliament", "rajya sabha", "lok sabha",
  "prime minister", "union cabinet", "rbi", "sebi", "election commission",
  "isro", "drdo", "imf", "world bank", "world health organization",
  "united nations", "g20", "brics", "niti aayog", "upsc", "gst council",
  "ministry of finance", "ministry of environment", "ministry of defence",
];

const LOCATION_DICTIONARY = [
  "india", "china", "pakistan", "bangladesh", "nepal", "bhutan", "myanmar",
  "sri lanka", "maldives", "nauru", "naoero", "united states", "united kingdom",
  "russia", "ukraine", "israel", "iran", "gaza", "west bank", "taiwan", "japan",
  "australia", "new zealand", "south africa", "brazil", "european union",
  "saudi arabia", "turkey", "türkiye", "malta", "finland",
  "new delhi", "delhi", "mumbai", "kolkata", "chennai", "bengaluru", "hyderabad",
  "arabian sea", "bay of bengal", "indian ocean", "pacific ocean", "red sea",
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
  ["renames", "rename"], ["renamed", "rename"], ["renaming", "rename"],
  ["releases", "release"], ["released", "release"], ["publishes", "release"], ["published", "release"],
  ["notifies", "notify"], ["notified", "notify"], ["declares", "declare"], ["declared", "declare"],
  ["elects", "elect"], ["elected", "elect"], ["appoints", "appoint"], ["appointed", "appoint"],
  ["bans", "ban"], ["banned", "ban"], ["allows", "allow"], ["allowed", "allow"],
  ["cuts", "cut"], ["cutting", "cut"], ["reduces", "cut"], ["reduced", "cut"],
  ["raises", "raise"], ["raised", "raise"], ["increases", "raise"], ["increased", "raise"],
  ["pact", "agreement"], ["pacts", "agreement"],
  ["transplant", "donation"], ["transplants", "donation"],
  ["transplantation", "donation"], ["donations", "donation"],
  ["conditions", "condition"], ["reforms", "reform"],
]);

const EVENT_ACTIONS = new Set([
  "launch", "approve", "pass", "sign", "announce", "rule", "reject", "issue",
  "tender", "establish", "attempt", "limit", "start", "rename", "release",
  "notify", "declare", "elect", "appoint", "ban", "allow",
  "cut", "raise",
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

function phraseSet(text = "") {
  const tokens = normalizeText(text)
    .split(" ")
    .map(stemToken)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word) && !EVENT_ACTIONS.has(word));
  const phrases = new Set();
  for (let index = 0; index < tokens.length - 1; index += 1) {
    phrases.add(`${tokens[index]} ${tokens[index + 1]}`);
  }
  return phrases;
}

function numberSet(text = "") {
  return new Set(
    String(text || "")
      .replace(/,/g, "")
      .match(/\b\d+(?:\.\d+)?(?:%|\s*(?:crore|lakh|million|billion|trillion|km|mw|gw))?\b/gi) || []
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

export function extractLocations(article = {}) {
  const text = normalizeText(`${article.title || ""} ${article.description || ""}`);
  return LOCATION_DICTIONARY.filter((location) => text.includes(location));
}

export function extractActions(article = {}) {
  return [...tokenSet(article.title || "")].filter((token) => EVENT_ACTIONS.has(token));
}

export function extractKeywords(article = {}) {
  return [...tokenSet(`${article.title || ""} ${article.description || ""}`)];
}

function coreTitleTokens(article = {}) {
  return [...tokenSet(article.title || "")]
    .filter((token) => !/^\d+$/.test(token))
    .sort();
}

function subjectTitleTokens(article = {}) {
  return coreTitleTokens(article).filter((token) => !EVENT_ACTIONS.has(token));
}

function distinctiveSignature(article = {}) {
  const raw = String(article.title || "");
  const acronyms = raw.match(/\b[A-Z][A-Z0-9-]{2,}\b/g) || [];
  const quantified = raw.match(/\b\d+(?:\.\d+)?\s*(?:kN|MW|GW|km|%|lakh|crore|million|billion)?\b/g) || [];
  return new Set(
    [...acronyms, ...quantified]
      .map((value) => normalizeText(value).replace(/\s+/g, "_"))
      .filter((value) => value && value.length > 1)
  );
}

/**
 * Stable event key used for queue/source bookkeeping. It intentionally ignores
 * dates and common newsroom verbs so the same announcement from another feed
 * does not become a new article just because the headline was rewritten.
 */
export function generateEventKey(article = {}) {
  const tokens = subjectTitleTokens(article).slice(0, 12);
  const entities = extractEntities(article).map((value) => value.replace(/\s+/g, "_"));
  const actions = extractActions(article).map((value) => `action:${value}`);
  const locations = extractLocations(article).map((value) => `place:${value.replace(/\s+/g, "_")}`);
  return [...new Set([...entities, ...actions, ...locations, ...tokens])].slice(0, 18).join("|");
}

export function generateEventFingerprint(article = {}) {
  return {
    normalizedTitle: normalizeText(article.title),
    titleKeywords: tokenSet(article.title),
    contextKeywords: tokenSet(`${article.title || ""} ${article.description || ""}`),
    entities: new Set(extractEntities(article)),
    actions: new Set(extractActions(article)),
    locations: new Set(extractLocations(article)),
    subjects: new Set(subjectTitleTokens(article)),
    titlePhrases: phraseSet(article.title || ""),
    numbers: numberSet(`${article.title || ""} ${article.description || ""}`),
    signature: distinctiveSignature(article),
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

  const dateDistance = daysApart(first.publishedAt, second.publishedAt);
  const sameNewsCycle = dateDistance === null || dateDistance <= 3;

  if (
    sameNewsCycle &&
    first.normalizedTitle &&
    first.normalizedTitle === second.normalizedTitle
  ) {
    return true;
  }

  if (
    sameNewsCycle &&
    first.eventKey &&
    second.eventKey &&
    first.eventKey === second.eventKey
  ) {
    return true;
  }

  const title = overlap(first.titleKeywords, second.titleKeywords);
  const context = overlap(first.contextKeywords, second.contextKeywords);
  const entities = overlap(first.entities, second.entities);
  const actions = overlap(first.actions, second.actions);
  const locations = overlap(first.locations, second.locations);
  const subjects = overlap(first.subjects, second.subjects);
  const phrases = overlap(first.titlePhrases, second.titlePhrases);
  const numbers = overlap(first.numbers, second.numbers);
  const signature = overlap(first.signature, second.signature);

  if (first.actions.size && second.actions.size && actions.common === 0) {
    return false;
  }

  if (dateDistance !== null && dateDistance > 3) {
    return false;
  }

  // Shared acronyms/measurements such as EVEREST + FFSC + 800 kN are a
  // strong same-event fingerprint even when publishers rewrite the headline.
  if (sameNewsCycle && signature.common >= 2 && title.common >= 3) {
    return true;
  }

  // Strong headline similarity inside one news cycle is the same event.
  if (title.common >= 5 && title.containment >= 0.78 && title.jaccard >= 0.52) {
    return true;
  }
  if (title.common >= 4 && title.containment >= 0.9) {
    return true;
  }

  // Short rewritten headlines such as “Organ Donation in India” and “Status
  // and Growth of Organ Donation in India” share too few tokens for ordinary
  // fuzzy matching, but an identical distinctive bigram in one news cycle is
  // strong event evidence. Shared figures make the signal even stronger.
  if (
    phrases.common > 0 &&
    title.common >= 2 &&
    title.containment >= 0.66 &&
    (Math.min(first.subjects.size, second.subjects.size) <= 3 || numbers.common > 0)
  ) {
    return true;
  }

  if (numbers.common > 0 && title.common >= 2 && title.containment >= 0.6) {
    return true;
  }

  // Entity/action/object/location matching catches rewritten headlines while
  // retaining the three-day news-cycle boundary for genuine later updates.
  if (
    actions.common > 0 &&
    subjects.common >= 2 &&
    (entities.common > 0 || locations.common > 0)
  ) {
    return true;
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
