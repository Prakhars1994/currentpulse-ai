import {
  loadCurrentAffairsCorpus,
  loadCurrentAffairsRange,
  loadNewsCorpus,
  loadNewsRange,
} from "@/lib/articleStreams";
import { indiaDayRange } from "@/lib/study/digestDates";

const cache = globalThis.__currentPulseHomepageStatsCacheV2 || { expiresAt: 0, value: null };
globalThis.__currentPulseHomepageStatsCacheV2 = cache;

function newestTimestamp(...groups) {
  const values = groups
    .flat()
    .map((item) => item?.updated_at || item?.created_at)
    .filter(Boolean)
    .map((value) => new Date(value).getTime())
    .filter(Number.isFinite);
  return values.length ? new Date(Math.max(...values)).toISOString() : null;
}

export async function loadHomepageStats() {
  if (cache.value && cache.expiresAt > Date.now()) return cache.value;

  const range = indiaDayRange();
  const [todayCA, todayNews, allCA, allNews] = await Promise.all([
    loadCurrentAffairsRange({ start: range.start, end: range.end, maxScan: 1200 }),
    loadNewsRange({ start: range.start, end: range.end, maxScan: 1200 }),
    loadCurrentAffairsCorpus({ maxScan: 5000 }),
    loadNewsCorpus({ maxScan: 5000 }),
  ]);

  const errors = [todayCA.error, todayNews.error, allCA.error, allNews.error]
    .filter(Boolean)
    .map((error) => error?.message || String(error));

  const value = {
    todayCurrentAffairs: todayCA.articles.length,
    todayNews: todayNews.articles.length,
    totalCurrentAffairs: allCA.articles.length,
    totalNews: allNews.articles.length,
    totalCurrentAffairsTruncated: Boolean(allCA.truncated),
    totalNewsTruncated: Boolean(allNews.truncated),
    lastUpdated: newestTimestamp(
      allCA.articles.slice(0, 3),
      allNews.articles.slice(0, 3)
    ),
    date: range.date,
    error: errors.length ? errors.join("; ") : null,
  };

  cache.value = value;
  cache.expiresAt = Date.now() + 120_000;
  return value;
}
