import { createServerSupabase } from "@/lib/supabase-server";
import { articleMatchesExam } from "@/lib/examPrep/examRelevance";
import { indiaDayRange } from "@/lib/study/digestDates";

const FULL_STREAM_FIELDS_INNER = `
  id,title,slug,category,paper,why_news,syllabus_linkage,india_relevance,
  static_foundation,data_examples,prelims,mains,answer_framework,question,
  visual_summary,memory_trick,content,tags,
  image,image_url,image_source_url,image_caption,image_search_query,language,created_at,updated_at,status,quality_score,quality_version,
  article_sources!inner(source_kind,source_name,source_title,source_url,source_published_at,source_key)
`;

const CURRENT_AFFAIRS_LIST_FIELDS_INNER = `
  id,title,slug,category,paper,why_news,
  static_foundation,data_examples,prelims,mains,tags,seo_description,
  image,image_url,image_source_url,image_caption,language,created_at,updated_at,status,quality_score,quality_version,
  article_sources!inner(source_kind,source_name,source_title,source_url,source_published_at,source_key)
`;

const NEWS_LIST_FIELDS_INNER = `
  id,title,slug,category,paper,why_news,seo_description,
  image,image_url,image_source_url,image_caption,created_at,updated_at,status,quality_score,quality_version,
  article_sources!inner(source_kind,source_name,source_title,source_url,source_published_at,source_key)
`;

// Reader routes hit the Worker first. Keep a short cache only to reduce repeated
// Supabase reads; administrator publications must become visible quickly.
const CACHE_TTL_MS = 60_000;
const streamCache = globalThis.__currentPulsePublicStreamCache || new Map();
globalThis.__currentPulsePublicStreamCache = streamCache;

async function ttlCached(key, loader, ttlMs = CACHE_TTL_MS) {
  const now = Date.now();
  const cached = streamCache.get(key);
  if (cached && cached.expiresAt > now) return cached.value;

  const value = await loader();
  streamCache.set(key, { expiresAt: now + ttlMs, value });

  if (streamCache.size > 120) {
    for (const [cacheKey, entry] of streamCache) {
      if (entry.expiresAt <= now) streamCache.delete(cacheKey);
    }
  }

  return value;
}

export function hasCoachingSource(article = {}) {
  return (article.article_sources || []).some(
    (source) => source?.source_kind === "coaching"
  );
}

export function hasNewsSource(article = {}) {
  return (article.article_sources || []).some(
    (source) => source?.source_kind === "news"
  );
}

export function hasAdminPdfSource(article = {}) {
  return (article.article_sources || []).some((source) =>
    String(source?.source_key || "").startsWith("pdf:")
  );
}

export function isLegacyNewsArticle() {
  // Public News is intentionally administrator-PDF only.
  return false;
}

export function isCurrentAffairsReady(article = {}) {
  // Administrator selection is the publication decision. Do not second-guess
  // it with quality gates, similarity filters or legacy source heuristics.
  return hasAdminPdfSource(article) && hasCoachingSource(article);
}

export function isPublicNewsArticle(article = {}) {
  return hasAdminPdfSource(article) && hasNewsSource(article);
}

export function coachingSourceLabel(article = {}) {
  const names = [...new Set(
    (article.article_sources || [])
      .filter((source) => source?.source_kind === "coaching")
      .map((source) => String(source.source_name || "").trim())
      .filter(Boolean)
  )];

  if (names.length === 0) return "CurrentPulse Editorial";
  if (names.length === 1) return names[0];
  return `${names[0]} +${names.length - 1}`;
}

export function currentAffairsSourceLabel(article = {}) {
  if (hasAdminPdfSource(article)) {
    const name = (article.article_sources || [])
      .map((source) => String(source?.source_name || "").trim())
      .find(Boolean);
    return name || "CurrentPulse Admin PDF";
  }
  return coachingSourceLabel(article);
}

function currentAffairsRows(rows = [], exam = "upsc") {
  const eligible = rows.filter(isCurrentAffairsReady);
  // The canonical UPSC archive must contain every administrator-published CA
  // item. Optional exam views may narrow that same canonical corpus.
  return exam === "upsc"
    ? eligible
    : eligible.filter((article) => articleMatchesExam(article, exam));
}

function newsRows(rows = []) {
  // Never event-dedupe administrator PDFs. Two selected rows may intentionally
  // cover the same event from different angles and both must remain visible.
  return rows.filter(isPublicNewsArticle);
}

async function fetchCurrentAffairsChunk(
  startIndex,
  endIndex,
  dayStart = "",
  dayEnd = "",
  language = "en"
) {
  const key = `ca:${startIndex}:${endIndex}:${dayStart}:${dayEnd}:${language}`;
  return ttlCached(key, async () => {
    const supabase = createServerSupabase();
    let query = supabase
      .from("articles")
      .select(CURRENT_AFFAIRS_LIST_FIELDS_INNER)
      .eq("status", "published")
      .eq("article_sources.source_kind", "coaching")
      .like("article_sources.source_key", "pdf:%")
      .order("created_at", { ascending: false })
      .range(startIndex, endIndex);

    query = language === "hi"
      ? query.eq("language", "hi")
      : query.or("language.is.null,language.eq.en");

    if (dayStart && dayEnd) {
      query = query.gte("created_at", dayStart).lt("created_at", dayEnd);
    }

    return query;
  });
}

async function fetchNewsChunk(startIndex, endIndex) {
  return ttlCached(`news:${startIndex}:${endIndex}`, async () => {
    const supabase = createServerSupabase();
    return supabase
      .from("articles")
      .select(NEWS_LIST_FIELDS_INNER)
      .eq("status", "published")
      .eq("article_sources.source_kind", "news")
      .like("article_sources.source_key", "pdf:%")
      .order("created_at", { ascending: false })
      .range(startIndex, endIndex);
  });
}

async function scanCanonicalStream({
  sourceKind,
  start = "",
  end = "",
  maxScan = 5000,
  language = "en",
} = {}) {
  const safeMax = Math.max(120, Math.min(Number(maxScan) || 5000, 10000));
  const key = `canonical:${sourceKind}:${start}:${end}:${safeMax}:${language}`;

  return ttlCached(key, async () => {
    const supabase = createServerSupabase();
    const BATCH = 120;
    let offset = 0;
    let rawRows = [];
    let exhausted = false;

    while (offset < safeMax && !exhausted) {
      const endIndex = Math.min(offset + BATCH - 1, safeMax - 1);
      let query = supabase
        .from("articles")
        .select(FULL_STREAM_FIELDS_INNER)
        .eq("status", "published")
        .eq("article_sources.source_kind", sourceKind)
        .like("article_sources.source_key", "pdf:%")
        .order("created_at", { ascending: false })
        .range(offset, endIndex);

      if (sourceKind === "coaching") {
        query = language === "hi"
          ? query.eq("language", "hi")
          : query.or("language.is.null,language.eq.en");
      }
      if (start) query = query.gte("created_at", start);
      if (end) query = query.lt("created_at", end);

      const { data, error } = await query;
      if (error) {
        return { articles: [], scanned: rawRows.length, error, truncated: false };
      }

      const batch = data || [];
      rawRows = rawRows.concat(batch);
      offset += batch.length;
      exhausted = batch.length < BATCH;
      if (!batch.length) exhausted = true;
    }

    const articles = sourceKind === "coaching"
      ? currentAffairsRows(rawRows)
      : newsRows(rawRows);

    return {
      articles,
      scanned: rawRows.length,
      error: null,
      truncated: !exhausted && offset >= safeMax,
    };
  }, 120_000);
}

export function loadCurrentAffairsRange({
  start = "",
  end = "",
  maxScan = 5000,
  language = "en",
} = {}) {
  return scanCanonicalStream({
    sourceKind: "coaching",
    start,
    end,
    maxScan,
    language,
  });
}

export function loadNewsRange({ start = "", end = "", maxScan = 5000 } = {}) {
  return scanCanonicalStream({ sourceKind: "news", start, end, maxScan });
}

export function loadCurrentAffairsCorpus({ maxScan = 5000, language = "en" } = {}) {
  return loadCurrentAffairsRange({ maxScan, language });
}

export function loadNewsCorpus({ maxScan = 5000 } = {}) {
  return loadNewsRange({ maxScan });
}

export async function loadCurrentAffairsRangePage({
  start = "",
  end = "",
  limit = 80,
  offset = 0,
  maxScan = 1800,
  language = "en",
} = {}) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 80, 100));
  const safeOffset = Math.max(0, Number(offset) || 0);
  const targetCount = safeOffset + safeLimit + 1;
  const safeMax = Math.max(120, Math.min(Number(maxScan) || 1800, 5000));
  const BATCH = 80;
  let rawOffset = 0;
  let rawRows = [];
  let prepared = [];
  let exhausted = false;

  while (rawOffset < safeMax && prepared.length < targetCount && !exhausted) {
    const endIndex = Math.min(rawOffset + BATCH - 1, safeMax - 1);
    const { data, error } = await fetchCurrentAffairsChunk(
      rawOffset,
      endIndex,
      start,
      end,
      language
    );
    if (error) {
      return {
        articles: [],
        hasMore: false,
        total: null,
        scanned: rawRows.length,
        error,
      };
    }

    const batch = data || [];
    rawRows = rawRows.concat(batch);
    prepared = currentAffairsRows(rawRows);
    rawOffset += batch.length;
    exhausted = batch.length < BATCH;
    if (!batch.length) exhausted = true;
  }

  return {
    articles: prepared.slice(safeOffset, safeOffset + safeLimit),
    hasMore:
      prepared.length > safeOffset + safeLimit ||
      (!exhausted && rawOffset < safeMax),
    total: exhausted ? prepared.length : null,
    scanned: rawRows.length,
    error: null,
  };
}

export async function loadCurrentAffairsArticles({
  limit = 24,
  offset = 0,
  todayOnly = false,
  exam = "upsc",
  language = "en",
} = {}) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 24, 60));
  const safeOffset = Math.max(0, Number(offset) || 0);
  const targetCount = safeOffset + safeLimit + 1;
  const day = indiaDayRange();
  const RAW_BATCH_SIZE = 48;
  const MAX_STREAM_SCAN = Math.max(exam === "upsc" ? 180 : 360, targetCount * 5);

  let rawOffset = 0;
  let rawRows = [];
  let prepared = [];
  let exhausted = false;

  while (
    rawOffset < MAX_STREAM_SCAN &&
    prepared.length < targetCount &&
    !exhausted
  ) {
    const endIndex = Math.min(
      rawOffset + RAW_BATCH_SIZE - 1,
      MAX_STREAM_SCAN - 1
    );
    const { data, error } = await fetchCurrentAffairsChunk(
      rawOffset,
      endIndex,
      todayOnly ? day.start : "",
      todayOnly ? day.end : "",
      language
    );

    if (error) {
      return {
        articles: [],
        total: 0,
        hasMore: false,
        date: day.date,
        error,
      };
    }

    const batch = data || [];
    rawRows = rawRows.concat(batch);
    prepared = currentAffairsRows(rawRows, exam);
    rawOffset += batch.length;
    exhausted = batch.length < RAW_BATCH_SIZE;
    if (!batch.length) exhausted = true;
  }

  return {
    articles: prepared.slice(safeOffset, safeOffset + safeLimit),
    total: exhausted ? prepared.length : null,
    hasMore:
      prepared.length > safeOffset + safeLimit ||
      (!exhausted && rawOffset < MAX_STREAM_SCAN),
    date: day.date,
    scanned: rawRows.length,
    error: null,
  };
}

export async function loadNewsArticles({ limit = 24, offset = 0 } = {}) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 24, 60));
  const safeOffset = Math.max(0, Number(offset) || 0);
  const targetCount = safeOffset + safeLimit + 1;
  const RAW_BATCH_SIZE = 48;
  const MAX_STREAM_SCAN = Math.max(180, targetCount * 3);

  let rawOffset = 0;
  let rawRows = [];
  let prepared = [];
  let exhausted = false;

  while (
    rawOffset < MAX_STREAM_SCAN &&
    prepared.length < targetCount &&
    !exhausted
  ) {
    const endIndex = Math.min(
      rawOffset + RAW_BATCH_SIZE - 1,
      MAX_STREAM_SCAN - 1
    );
    const { data, error } = await fetchNewsChunk(rawOffset, endIndex);

    if (error) {
      console.error("News stream fetch failed:", error.message);
      return {
        articles: [],
        total: null,
        hasMore: false,
        scanned: rawRows.length,
        error,
      };
    }

    const batch = data || [];
    rawRows = rawRows.concat(batch);
    prepared = newsRows(rawRows);
    rawOffset += batch.length;
    exhausted = batch.length < RAW_BATCH_SIZE;
    if (!batch.length) exhausted = true;
  }

  return {
    articles: prepared.slice(safeOffset, safeOffset + safeLimit),
    total: exhausted ? prepared.length : null,
    hasMore:
      prepared.length > safeOffset + safeLimit ||
      (!exhausted && rawOffset < MAX_STREAM_SCAN),
    scanned: rawRows.length,
    error: null,
  };
}

export async function loadArticleStreams(limit = 160) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 160, 240));
  const [currentAffairsResult, newsResult] = await Promise.all([
    loadCurrentAffairsArticles({ limit: safeLimit, offset: 0 }),
    loadNewsArticles({ limit: safeLimit, offset: 0 }),
  ]);

  return {
    currentAffairs: currentAffairsResult.articles,
    news: newsResult.articles,
    error: currentAffairsResult.error || newsResult.error || null,
  };
}
