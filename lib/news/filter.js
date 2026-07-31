


import { isSameEvent } from "@/lib/news/eventCluster";
const EXCLUDED_WORDS = [
  "celebrity", "actor", "actress", "movie", "film", "box office", "fashion",
  "horoscope", "astrology", "viral video", "recipe", "cricket score",
  "football score", "lottery", "relationship", "wedding", "entertainment",
];

const PRIORITY_WORDS = [
  "cabinet", "parliament", "supreme court", "constitution", "policy", "scheme",
  "bill", "act", "rules", "economy", "inflation", "gdp", "rbi", "banking",
  "agriculture", "environment", "climate", "biodiversity", "energy", "science",
  "technology", "space", "isro", "defence", "security", "international",
  "agreement", "trade", "health", "education", "governance", "disaster",
  "artificial intelligence", "semiconductor", "world bank", "imf", "united nations",
];

function normalizedTitle(title = "") {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleTokens(title = "") {
  return new Set(
    normalizedTitle(title)
      .split(" ")
      .filter((token) => token.length > 3)
  );
}

function similarity(firstTitle, secondTitle) {
  const first = titleTokens(firstTitle);
  const second = titleTokens(secondTitle);
  if (!first.size || !second.size) return 0;

  let intersection = 0;
  for (const token of first) {
    if (second.has(token)) intersection += 1;
  }
  return intersection / Math.min(first.size, second.size);
}

export function preliminaryScore(article) {
  const text = `${article.title} ${article.description || ""}`.toLowerCase();
  const priority = PRIORITY_WORDS.reduce(
    (score, word) => score + (text.includes(word) ? 1 : 0),
    0
  );
  const officialBonus = article.sourceGroup === "official" ? 2 : 0;
  return priority + officialBonus;
}

export function isExcludedArticle(article) {
  const title = article.title.toLowerCase();
  return EXCLUDED_WORDS.some((word) => title.includes(word));
}

export function deduplicateArticles(articles) {
  const accepted = [];
  const seenUrls = new Set();

  for (const article of articles) {
    if (!article?.title || !article?.url || isExcludedArticle(article)) continue;
    if (seenUrls.has(article.url)) continue;

   const duplicate = accepted.find((existing) =>
  isSameEvent(existing, article)
);

    if (duplicate) {
      duplicate.coverage = Array.from(
        new Set([...(duplicate.coverage || [duplicate.source]), article.source])
      );
      continue;
    }

    seenUrls.add(article.url);
    accepted.push({
      ...article,
      preliminaryScore: preliminaryScore(article),
      coverage: [article.source],
    });
  }

  return accepted.sort((a, b) => {
    const scoreDifference = b.preliminaryScore - a.preliminaryScore;
    if (scoreDifference !== 0) return scoreDifference;
    return new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0);
  });
}
