import { supabase } from "@/lib/supabase";
import { isSameEvent } from "@/lib/news/eventCluster";
import { isDisplayWorthyNews } from "@/lib/news/newsQuality";
import { parseNewsPresentation } from "@/lib/news/newsPresentation";
import { isCoverageNoiseTitle } from "@/lib/coverage/noiseFilter";
import { isPublishedArticleSafe } from "@/lib/editorial/publicationSafety";

const ARTICLE_STREAM_FIELDS = `
  id,
  title,
  slug,
  category,
  paper,
  why_news,
  syllabus_linkage,
  prelims,
  mains,
  content,
  image,
  image_url,
  image_source_url,
  created_at,
  views,
  status,
  quality_score,
  article_sources(source_kind,source_name,source_url,source_published_at)
`;

const CURRENT_AFFAIRS_LIST_FIELDS = `
  id,title,slug,category,paper,why_news,syllabus_linkage,prelims,mains,
  image,image_url,image_source_url,created_at,views,status,quality_score,
  article_sources(source_kind,source_name,source_url,source_published_at)
`;

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

/**
 * Articles published before the source registry was introduced do not have an
 * article_sources row. Those rows powered the original News archive and must
 * not disappear merely because newer articles carry explicit provenance.
 * Coaching rows are never treated as legacy News.
 */
export function isLegacyNewsArticle(article = {}) {
  const sources = article.article_sources || [];
  return sources.length === 0 && !hasCoachingSource(article);
}

export function isCurrentAffairsReady(article = {}) {
  if (isCoverageNoiseTitle(article.title)) return false;
  if (!isPublishedArticleSafe(article, { stream: "coverage" })) return false;
  return hasCoachingSource(article);
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
  return dedupeStream(
    rows
      .filter((article) =>
        (hasNewsSource(article) || isLegacyNewsArticle(article)) &&
        isDisplayWorthyNews(article)
      )
      .map((article) => {
        const newsPresentation = parseNewsPresentation(article.content);
        if (!newsPresentation) return article;
        return {
          ...article,
          title: newsPresentation.title || article.title,
          why_news: newsPresentation.lead || article.why_news,
        };
      })
  );
}

function indiaDayRange() {
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  const start = new Date(`${date}T00:00:00+05:30`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { date, start: start.toISOString(), end: end.toISOString() };
}

/**
 * Fill only the requested CA page. Scanning the complete archive made the
 * route time out as soon as the coaching backlog published hundreds of rows.
 */
export async function loadCurrentAffairsArticles({ limit = 48, offset = 0, todayOnly = false } = {}) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 48, 100));
  const safeOffset = Math.max(0, Number(offset) || 0);
  const RAW_BATCH_SIZE = 250;
  const MAX_RAW_SCAN = 6000;
  const targetCount = safeOffset + safeLimit + 1;
  const day = indiaDayRange();
  let rawOffset = 0;
  let rawRows = [];
  let prepared = [];
  let exhausted = false;

  while (rawOffset < MAX_RAW_SCAN && prepared.length < targetCount && !exhausted) {
    const end = Math.min(rawOffset + RAW_BATCH_SIZE - 1, MAX_RAW_SCAN - 1);
    let query = supabase
      .from("articles")
      .select(CURRENT_AFFAIRS_LIST_FIELDS)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .range(rawOffset, end);
    if (todayOnly) query = query.gte("created_at", day.start).lt("created_at", day.end);
    const { data, error } = await query;
    if (error) return { articles: [], total: 0, hasMore: false, date: day.date, error };
    const batch = data || [];
    rawRows = rawRows.concat(batch);
    prepared = dedupeStream(rawRows.filter(isCurrentAffairsReady));
    rawOffset += batch.length;
    exhausted = batch.length < RAW_BATCH_SIZE;
    if (!batch.length) exhausted = true;
  }

  return {
    articles: prepared.slice(safeOffset, safeOffset + safeLimit),
    total: exhausted ? prepared.length : null,
    hasMore: prepared.length > safeOffset + safeLimit || (!exhausted && rawOffset < MAX_RAW_SCAN),
    date: day.date,
    scanned: rawRows.length,
    error: null,
  };
}

/**
 * Load the News archive from explicit NEWS-source rows and legacy rows that
 * pre-date article_sources. Explicit coaching rows remain excluded.
 *
 * Filtering/deduplication happens after the database query. Fetching exactly
 * one raw page and filtering afterwards can leave only 1-2 visible cards and
 * makes older stories appear to vanish. Scan forward in bounded chunks until
 * the requested display page is full (or the archive is exhausted), then
 * paginate the cleaned/deduplicated rows.
 */
export async function loadNewsArticles({ limit = 48, offset = 0 } = {}) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 48, 100));
  const safeOffset = Math.max(0, Number(offset) || 0);
  const targetCount = safeOffset + safeLimit + 1;
  const RAW_BATCH_SIZE = 250;
  const MAX_RAW_SCAN = 6000;

  let rawOffset = 0;
  let rawRows = [];
  let prepared = [];
  let exhausted = false;

  while (
    rawOffset < MAX_RAW_SCAN &&
    prepared.length < targetCount &&
    !exhausted
  ) {
    const end = Math.min(
      rawOffset + RAW_BATCH_SIZE - 1,
      MAX_RAW_SCAN - 1
    );

    const { data, error } = await supabase
      .from("articles")
      .select(ARTICLE_STREAM_FIELDS)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .range(rawOffset, end);

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
    prepared = prepareNewsRows(rawRows);

    rawOffset += batch.length;
    exhausted = batch.length < RAW_BATCH_SIZE;
    if (!batch.length) exhausted = true;
  }

  const articles = prepared.slice(safeOffset, safeOffset + safeLimit);
  const hasMore =
    prepared.length > safeOffset + safeLimit ||
    (!exhausted && rawOffset < MAX_RAW_SCAN);

  return {
    articles,
    total: exhausted ? prepared.length : null,
    hasMore,
    scanned: rawRows.length,
    error: null,
  };
}

export async function loadArticleStreams(limit = 320) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 320, 500));

  const [currentAffairsResult, newsResult] = await Promise.all([
    supabase
      .from("articles")
      .select(ARTICLE_STREAM_FIELDS)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(safeLimit),
    loadNewsArticles({ limit: safeLimit, offset: 0 }),
  ]);

  if (currentAffairsResult.error) {
    console.error("Current affairs stream fetch failed:", currentAffairsResult.error.message);
  }

  const rows = currentAffairsResult.data || [];

  return {
    currentAffairs: dedupeStream(rows.filter(isCurrentAffairsReady)),
    news: newsResult.articles,
    error: currentAffairsResult.error || newsResult.error || null,
  };
}
