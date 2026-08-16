import {
  loadCurrentAffairsArticles,
  loadNewsArticles,
} from "@/lib/articleStreams";
import { createServerSupabase } from "@/lib/supabase-server";
import { indiaDayRange } from "@/lib/study/digestDates";

const CACHE_TTL_MS = 120_000;

const snapshotCache =
  globalThis.__currentPulseHomepageSnapshotCacheV4 || new Map();

globalThis.__currentPulseHomepageSnapshotCacheV4 = snapshotCache;

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

async function withTimeout(loader, ms, fallback) {
  let timer;

  try {
    return await Promise.race([
      Promise.resolve().then(loader),

      new Promise((resolve) => {
        timer = setTimeout(() => resolve(fallback), ms);
      }),
    ]);
  } catch {
    return fallback;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function countStream(sourceKind, start = "", end = "") {
  try {
    const supabase = createServerSupabase();

    let query = supabase
      .from("articles")
      .select(
        "id,article_sources!inner(source_kind)",
        { count: "exact" }
      )
      .eq("status", "published")
      .eq("article_sources.source_kind", sourceKind)
      .limit(1);

    if (start) {
      query = query.gte("created_at", start);
    }

    if (end) {
      query = query.lt("created_at", end);
    }

    const { count, error } = await query;

    if (error) {
      return {
        count: null,
        error,
      };
    }

    return {
      count: Number(count || 0),
      error: null,
    };
  } catch (error) {
    return {
      count: null,
      error,
    };
  }
}

export async function loadHomepageSnapshot(limit = 12) {
  const safeLimit = Math.max(
    8,
    Math.min(Number(limit) || 12, 24)
  );

  const cacheKey = `homepage:${safeLimit}`;
  const now = Date.now();

  const cached = snapshotCache.get(cacheKey);

  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const range = indiaDayRange();

  const streamFallback = {
    articles: [],
    total: null,
    hasMore: false,
    scanned: 0,
    error: null,
  };

  const countFallback = {
    count: null,
    error: null,
  };

  /*
   * Homepage strategy:
   *
   * - Fetch only the handful of articles actually displayed.
   * - Get counters using database COUNT queries.
   * - Never scan thousands of article bodies for homepage statistics.
   * - Fail quickly instead of blocking the whole homepage/build.
   */
  const [
    currentAffairsResult,
    newsResult,
    todayCurrentAffairsCount,
    todayNewsCount,
    totalCurrentAffairsCount,
    totalNewsCount,
  ] = await Promise.all([
    withTimeout(
      () =>
        loadCurrentAffairsArticles({
          limit: safeLimit,
          offset: 0,
          todayOnly: false,
          exam: "upsc",
        }),
      10_000,
      streamFallback
    ),

    withTimeout(
      () =>
        loadNewsArticles({
          limit: safeLimit,
          offset: 0,
        }),
      10_000,
      streamFallback
    ),

    withTimeout(
      () =>
        countStream(
          "coaching",
          range.start,
          range.end
        ),
      6_000,
      countFallback
    ),

    withTimeout(
      () =>
        countStream(
          "news",
          range.start,
          range.end
        ),
      6_000,
      countFallback
    ),

    withTimeout(
      () => countStream("coaching"),
      6_000,
      countFallback
    ),

    withTimeout(
      () => countStream("news"),
      6_000,
      countFallback
    ),
  ]);

  const currentAffairs =
    currentAffairsResult?.articles || [];

  const news =
    newsResult?.articles || [];

  const startMs = timestamp(range.start);
  const endMs = timestamp(range.end);

  const visibleTodayCA =
    currentAffairs.filter((item) =>
      inRange(item, startMs, endMs)
    ).length;

  const visibleTodayNews =
    news.filter((item) =>
      inRange(item, startMs, endMs)
    ).length;

  const stats = {
    todayCurrentAffairs:
      todayCurrentAffairsCount.count ??
      visibleTodayCA,

    todayNews:
      todayNewsCount.count ??
      visibleTodayNews,

    totalCurrentAffairs:
      totalCurrentAffairsCount.count ??
      currentAffairsResult?.total ??
      currentAffairs.length,

    totalNews:
      totalNewsCount.count ??
      newsResult?.total ??
      news.length,

    totalCurrentAffairsTruncated: false,
    totalNewsTruncated: false,

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