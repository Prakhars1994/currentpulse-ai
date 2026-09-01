import {
  loadCurrentAffairsArticles,
  loadNewsArticles,
} from "@/lib/articleStreams";
import { indiaDayRange } from "@/lib/study/digestDates";

const CACHE_TTL_MS = 60_000;

const snapshotCache =
  globalThis.__currentPulseHomepageSnapshotCacheV5 || new Map();

globalThis.__currentPulseHomepageSnapshotCacheV5 = snapshotCache;

function timestamp(value) {
  const time = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(time) ? time : 0;
}

function newestTimestamp(...groups) {
  const values = groups
    .flat()
    .map((item) => timestamp(item?.updated_at || item?.created_at))
    .filter((value) => value > 0);

  return values.length
    ? new Date(Math.max(...values)).toISOString()
    : null;
}

function inRange(item, startMs, endMs) {
  const value = timestamp(item?.created_at);
  return value >= startMs && value < endMs;
}

export async function loadHomepageSnapshot(limit = 12) {
  const safeLimit = Math.max(8, Math.min(Number(limit) || 12, 24));
  const cacheKey = `homepage:${safeLimit}`;
  const now = Date.now();
  const cached = snapshotCache.get(cacheKey);

  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const range = indiaDayRange();

  /*
   * Keep the Cloudflare homepage deliberately cheap.
   *
   * The previous implementation ran two stream reads plus four exact
   * relationship COUNT queries and wrapped them in Promise.race timeouts.
   * Those timers stopped waiting but did not cancel the underlying Supabase
   * requests, so expensive work could continue after the homepage had already
   * fallen back. On Workers that can surface as error 1102 (resource limits).
   *
   * The homepage only needs the latest cards. Two bounded PDF-only stream
   * reads are enough; archive pages remain the authority for full totals.
   */
  const [currentAffairsResult, newsResult] = await Promise.all([
    loadCurrentAffairsArticles({
      limit: safeLimit,
      offset: 0,
      todayOnly: false,
      exam: "upsc",
    }).catch((error) => ({
      articles: [],
      total: null,
      hasMore: false,
      scanned: 0,
      error,
    })),
    loadNewsArticles({
      limit: safeLimit,
      offset: 0,
    }).catch((error) => ({
      articles: [],
      total: null,
      hasMore: false,
      scanned: 0,
      error,
    })),
  ]);

  const currentAffairs = currentAffairsResult?.articles || [];
  const news = newsResult?.articles || [];
  const startMs = timestamp(range.start);
  const endMs = timestamp(range.end);

  const visibleTodayCA = currentAffairs.filter((item) =>
    inRange(item, startMs, endMs)
  ).length;
  const visibleTodayNews = news.filter((item) =>
    inRange(item, startMs, endMs)
  ).length;

  const stats = {
    todayCurrentAffairs: visibleTodayCA,
    todayNews: visibleTodayNews,
    totalCurrentAffairs:
      currentAffairsResult?.total ?? currentAffairs.length,
    totalNews:
      newsResult?.total ?? news.length,
    totalCurrentAffairsTruncated:
      currentAffairsResult?.total == null && Boolean(currentAffairsResult?.hasMore),
    totalNewsTruncated:
      newsResult?.total == null && Boolean(newsResult?.hasMore),
    lastUpdated: newestTimestamp(
      currentAffairs.slice(0, 6),
      news.slice(0, 6)
    ),
    date: range.date,
    error:
      currentAffairsResult?.error ||
      newsResult?.error ||
      null,
  };

  const value = {
    streams: {
      currentAffairs,
      news,
      error:
        currentAffairsResult?.error ||
        newsResult?.error ||
        null,
    },
    stats,
  };

  snapshotCache.set(cacheKey, {
    value,
    expiresAt: now + CACHE_TTL_MS,
  });

  if (snapshotCache.size > 12) {
    for (const [key, entry] of snapshotCache) {
      if (entry.expiresAt <= now) {
        snapshotCache.delete(key);
      }
    }
  }

  return value;
}

export async function loadHomepageStats() {
  return (await loadHomepageSnapshot(12)).stats;
}
