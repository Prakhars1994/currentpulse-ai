import { createServerSupabase } from "@/lib/supabase-server";
import { isSameEvent } from "@/lib/news/eventCluster";
import { isArchiveWorthyNews } from "@/lib/news/newsQuality";
// Full News bodies are fetched only by detail/corpus paths, never list pages.
import { isCoverageNoiseTitle } from "@/lib/coverage/noiseFilter";
import { isPublishedArticleSafe } from "@/lib/editorial/publicationSafety";
import { articleMatchesExam } from "@/lib/examPrep/examRelevance";
import { indiaDayRange } from "@/lib/study/digestDates";
import { isStandaloneCurrentAffairsArticle } from "@/lib/sitemapQuality";

const FULL_STREAM_FIELDS = `
  id,title,slug,category,paper,why_news,syllabus_linkage,india_relevance,
  static_foundation,data_examples,prelims,mains,answer_framework,question,
  visual_summary,memory_trick,content,tags,
  image,image_url,image_source_url,image_caption,image_search_query,created_at,updated_at,status,quality_score,quality_version,
  article_sources(source_kind,source_name,source_title,source_url,source_published_at)
`;

const FULL_STREAM_FIELDS_INNER = `
  id,title,slug,category,paper,why_news,syllabus_linkage,india_relevance,
  static_foundation,data_examples,prelims,mains,answer_framework,question,
  visual_summary,memory_trick,content,tags,
  image,image_url,image_source_url,image_caption,image_search_query,created_at,updated_at,status,quality_score,quality_version,
  article_sources!inner(source_kind,source_name,source_title,source_url,source_published_at)
`;

const CURRENT_AFFAIRS_LIST_FIELDS_INNER = `
  id,title,slug,category,paper,why_news,
  static_foundation,data_examples,prelims,mains,tags,seo_description,
  image,image_url,image_source_url,image_caption,language,created_at,updated_at,status,quality_score,quality_version,
  article_sources!inner(source_kind,source_name,source_title,source_url,source_published_at)
`;

const NEWS_LIST_FIELDS_INNER = `
  id,title,slug,category,paper,why_news,seo_description,
  image,image_url,image_source_url,image_caption,created_at,updated_at,status,quality_score,quality_version,
  article_sources!inner(source_kind,source_name,source_title,source_url,source_published_at)
`;

const LEGACY_NEWS_LIST_FIELDS = `
  id,title,slug,category,paper,why_news,seo_description,
  image,image_url,image_source_url,image_caption,created_at,updated_at,status,quality_score,quality_version,
  article_sources(source_kind,source_name,source_title,source_url,source_published_at)
`;

// Asset-first routing previously made this five-minute process-local cache an
// additional freshness ceiling. Critical reader routes now reach the Worker;
// keep the small cost-saving cache, but bound public lag to one minute.
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

export function isLegacyNewsArticle(article = {}) {
  const sources = article.article_sources || [];
  return sources.length === 0 && !hasCoachingSource(article);
}

export function isCurrentAffairsReady(article = {}) {
  if (!isStandaloneCurrentAffairsArticle(article)) return false;
  if (isCoverageNoiseTitle(article.title)) return false;
  if (!isPublishedArticleSafe(article, { stream: "coverage" })) return false;
  if (Number(article.quality_version || 0) >= 4 && Number(article.quality_score || 0) < 72) return false;
  return hasCoachingSource(article);
}

export function isPublicNewsArticle(article = {}) {
  return (
    (hasNewsSource(article) || isLegacyNewsArticle(article)) &&
    isArchiveWorthyNews(article)
  );
}

export function coachingSourceLabel(article = {}) {
  const names = [...new Set(
    (article.article_sources || [])
      .filter((source) => source?.source_kind === "coaching")
      .map((source) => String(source.source_name || "").trim())
      .filter(Boolean)
  )];

  if (names.length === 0) return "Coaching synthesis";
  if (names.length === 1) return names[0];
  return `${names[0]} +${names.length - 1}`;
}

export function currentAffairsSourceLabel(article = {}) {
  if (hasCoachingSource(article)) return coachingSourceLabel(article);

  const names = [...new Set(
    (article.article_sources || [])
      .filter((source) => source?.source_kind === "news")
      .map((source) => String(source.source_name || "").trim())
      .filter(Boolean)
  )];
  if (names.length === 0) return "CurrentPulse UPSC analysis";
  if (names.length === 1) return `${names[0]} · UPSC analysis`;
  return `${names[0]} +${names.length - 1} · UPSC analysis`;
}

const TITLE_STOP_WORDS = new Set([
  "the","a","an","and","or","of","to","for","in","on","at","by","with","from",
  "india","indian","new","latest","explained","why","what","how","current","affairs",
  "upsc","news","need","towards","over","under","after","before","amid","as"
]);

function titleTokens(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((token) => token.replace(/^-+|-+$/g, ""))
    .filter((token) => token.length > 2 && !TITLE_STOP_WORDS.has(token));
}

function closeInNewsCycle(left = {}, right = {}, maxDays = 3) {
  const a = new Date(left.created_at || 0).getTime();
  const b = new Date(right.created_at || 0).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return true;
  return Math.abs(a - b) <= maxDays * 24 * 60 * 60 * 1000;
}

function titleContainment(left = "", right = "") {
  const a = [...new Set(titleTokens(left))];
  const b = [...new Set(titleTokens(right))];
  if (Math.min(a.length, b.length) < 3) return 0;
  const bSet = new Set(b);
  const overlap = a.filter((token) => bSet.has(token)).length;
  return overlap / Math.min(a.length, b.length);
}

function dedupeStream(rows = []) {
  const kept = [];
  for (const article of rows) {
    const duplicate = kept.some((existing) => {
      const eventMatch = isSameEvent(
        { title: article.title, description: article.why_news, publishedAt: article.created_at },
        { title: existing.title, description: existing.why_news, publishedAt: existing.created_at }
      );
      if (eventMatch) return true;
      return closeInNewsCycle(article, existing, 3) &&
        titleContainment(article.title, existing.title) >= 0.72;
    });
    if (!duplicate) kept.push(article);
  }
  return kept;
}

function prepareNewsRows(rows = []) {
  // Public News list queries intentionally do not fetch the full article body.
  // Title and why_news are already persisted as list-ready fields.
  return dedupeStream(rows.filter(isPublicNewsArticle));
}

async function fetchCurrentAffairsChunk(startIndex, endIndex, dayStart = "", dayEnd = "", language = "en") {
  const key = `ca:${startIndex}:${endIndex}:${dayStart}:${dayEnd}:${language}`;
  return ttlCached(key, async () => {
    const supabase = createServerSupabase();
    let query = supabase
      .from("articles")
      .select(CURRENT_AFFAIRS_LIST_FIELDS_INNER)
      .eq("status", "published")
      .eq("article_sources.source_kind", "coaching")
      .order("created_at", { ascending: false })
      .range(startIndex, endIndex);
    query = language === "hi"
      ? query.eq("language", "hi")
      : query.or("language.is.null,language.eq.en");
    if (dayStart && dayEnd) query = query.gte("created_at", dayStart).lt("created_at", dayEnd);
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
      .order("created_at", { ascending: false })
      .range(startIndex, endIndex);
  });
}

async function fetchLegacyNewsFallback() {
  return ttlCached("news:legacy", async () => {
    const supabase = createServerSupabase();
    return supabase
      .from("articles")
      .select(LEGACY_NEWS_LIST_FIELDS)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(120);
  });
}

async function scanCanonicalStream({ sourceKind, start = "", end = "", maxScan = 5000 } = {}) {
  const safeMax = Math.max(120, Math.min(Number(maxScan) || 5000, 10000));
  const key = `canonical:${sourceKind}:${start}:${end}:${safeMax}`;
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
        .order("created_at", { ascending: false })
        .range(offset, endIndex);
      if (start) query = query.gte("created_at", start);
      if (end) query = query.lt("created_at", end);

      const { data, error } = await query;
      if (error) return { articles: [], scanned: rawRows.length, error, truncated: false };
      const batch = data || [];
      rawRows = rawRows.concat(batch);
      offset += batch.length;
      exhausted = batch.length < BATCH;
      if (!batch.length) exhausted = true;
    }

    const articles = sourceKind === "coaching"
      ? dedupeStream(rawRows.filter(isCurrentAffairsReady))
      : prepareNewsRows(rawRows);
    return {
      articles,
      scanned: rawRows.length,
      error: null,
      truncated: !exhausted && offset >= safeMax,
    };
  }, 120_000);
}

export function loadCurrentAffairsRange({ start = "", end = "", maxScan = 5000 } = {}) {
  return scanCanonicalStream({ sourceKind: "coaching", start, end, maxScan });
}
export function loadNewsRange({ start = "", end = "", maxScan = 5000 } = {}) {
  return scanCanonicalStream({ sourceKind: "news", start, end, maxScan });
}
export function loadCurrentAffairsCorpus({ maxScan = 5000 } = {}) {
  return loadCurrentAffairsRange({ maxScan });
}
export function loadNewsCorpus({ maxScan = 5000 } = {}) {
  return loadNewsRange({ maxScan });
}

export async function loadCurrentAffairsRangePage({ start = "", end = "", limit = 80, offset = 0, maxScan = 1800 } = {}) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 80, 100));
  const safeOffset = Math.max(0, Number(offset) || 0);
  const targetCount = safeOffset + safeLimit + 1;
  const safeMax = Math.max(120, Math.min(Number(maxScan) || 1800, 5000));
  const BATCH = 80;
  let rawOffset = 0, rawRows = [], prepared = [], exhausted = false;
  while (rawOffset < safeMax && prepared.length < targetCount && !exhausted) {
    const endIndex = Math.min(rawOffset + BATCH - 1, safeMax - 1);
    const { data, error } = await fetchCurrentAffairsChunk(rawOffset, endIndex, start, end);
    if (error) return { articles: [], hasMore: false, total: null, scanned: rawRows.length, error };
    const batch = data || []; rawRows = rawRows.concat(batch); prepared = dedupeStream(rawRows.filter(isCurrentAffairsReady));
    rawOffset += batch.length; exhausted = batch.length < BATCH; if (!batch.length) exhausted = true;
  }
  return { articles: prepared.slice(safeOffset, safeOffset + safeLimit), hasMore: prepared.length > safeOffset + safeLimit || (!exhausted && rawOffset < safeMax), total: exhausted ? prepared.length : null, scanned: rawRows.length, error: null };
}

export async function loadCurrentAffairsArticles({ limit = 24, offset = 0, todayOnly = false, exam = "upsc", language = "en" } = {}) {
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

  while (rawOffset < MAX_STREAM_SCAN && prepared.length < targetCount && !exhausted) {
    const end = Math.min(rawOffset + RAW_BATCH_SIZE - 1, MAX_STREAM_SCAN - 1);
    const { data, error } = await fetchCurrentAffairsChunk(
      rawOffset,
      end,
      todayOnly ? day.start : "",
      todayOnly ? day.end : "",
      language
    );
    if (error) return { articles: [], total: 0, hasMore: false, date: day.date, error };

    const batch = data || [];
    rawRows = rawRows.concat(batch);
    prepared = dedupeStream(rawRows.filter(isCurrentAffairsReady).filter((article) => articleMatchesExam(article, exam)));
    rawOffset += batch.length;
    exhausted = batch.length < RAW_BATCH_SIZE;
    if (!batch.length) exhausted = true;
  }

  return {
    articles: prepared.slice(safeOffset, safeOffset + safeLimit),
    total: exhausted ? prepared.length : null,
    hasMore: prepared.length > safeOffset + safeLimit || (!exhausted && rawOffset < MAX_STREAM_SCAN),
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

  while (rawOffset < MAX_STREAM_SCAN && prepared.length < targetCount && !exhausted) {
    const end = Math.min(rawOffset + RAW_BATCH_SIZE - 1, MAX_STREAM_SCAN - 1);
    const { data, error } = await fetchNewsChunk(rawOffset, end);
    if (error) {
      console.error("News stream fetch failed:", error.message);
      return { articles: [], total: null, hasMore: false, scanned: rawRows.length, error };
    }

    const batch = data || [];
    rawRows = rawRows.concat(batch);
    prepared = prepareNewsRows(rawRows);
    rawOffset += batch.length;
    exhausted = batch.length < RAW_BATCH_SIZE;
    if (!batch.length) exhausted = true;
  }

  if (prepared.length < targetCount) {
    const { data: legacyData, error: legacyError } = await fetchLegacyNewsFallback();
    if (!legacyError) {
      const legacyRows = (legacyData || []).filter(isLegacyNewsArticle);
      const combined = [...rawRows, ...legacyRows].sort(
        (left, right) => new Date(right.created_at || 0) - new Date(left.created_at || 0)
      );
      prepared = prepareNewsRows(combined);
      if (legacyRows.length) exhausted = true;
    }
  }

  return {
    articles: prepared.slice(safeOffset, safeOffset + safeLimit),
    total: exhausted ? prepared.length : null,
    hasMore: prepared.length > safeOffset + safeLimit || (!exhausted && rawOffset < MAX_STREAM_SCAN),
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
