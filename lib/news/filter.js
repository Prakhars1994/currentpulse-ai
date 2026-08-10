import { isSameEvent } from "@/lib/news/eventCluster";
const EXCLUDED_WORDS = [
  "horoscope", "astrology", "viral video", "recipe", "lottery result",
  "daily prediction", "betting tips", "coupon code",
];

const PRIORITY_WORDS = [
  "cabinet", "parliament", "supreme court", "constitution", "policy", "scheme",
  "bill", "act", "rules", "economy", "inflation", "gdp", "rbi", "banking",
  "agriculture", "environment", "climate", "biodiversity", "energy", "science",
  "technology", "space", "isro", "defence", "security", "international",
  "agreement", "trade", "health", "education", "governance", "disaster",
  "artificial intelligence", "semiconductor",
  "election", "minister", "government", "court", "protest", "crime", "accident",
  "railway", "aviation", "jobs", "employment", "company", "markets", "startup",
  "sports", "cricket", "football", "olympics", "culture", "cinema", "award",
];

export function preliminaryScore(article) {
  const text = `${article.title} ${article.description || ""}`.toLowerCase();
  const priority = PRIORITY_WORDS.reduce(
    (score, word) => score + (text.includes(word) ? 1 : 0),
    0
  );
  const officialBonus = article.sourceGroup === "official" && article.region === "IN" ? 2 : 0;
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

    const duplicate = accepted.find((existing) => isSameEvent(existing, article));

    if (duplicate) {
      duplicate.coverage = Array.from(
        new Set([...(duplicate.coverage || [duplicate.source]), article.source])
      );
      const additionalDescription = String(article.description || "").trim();
      if (
        additionalDescription &&
        !String(duplicate.description || "").includes(additionalDescription)
      ) {
        duplicate.description = `${duplicate.description || ""}\n\nADDITIONAL COVERAGE (${article.source || "source"}): ${additionalDescription}`
          .trim()
          .slice(0, 6500);
      }
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
    const scoreDifference =
      (b.preliminaryScore + Math.min(8, (b.coverage?.length || 1) * 2)) -
      (a.preliminaryScore + Math.min(8, (a.coverage?.length || 1) * 2));
    if (scoreDifference !== 0) return scoreDifference;
    return new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0);
  });
}
