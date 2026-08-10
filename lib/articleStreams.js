import { supabase } from "@/lib/supabase";
import { isSameEvent } from "@/lib/news/eventCluster";
import { isDisplayWorthyNews } from "@/lib/news/newsQuality";
import { hasNewsPresentation, parseNewsPresentation } from "@/lib/news/newsPresentation";

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
  article_sources(source_kind,source_name,source_published_at)
`;

const NEWS_STREAM_FIELDS = `
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
  article_sources!inner(source_kind,source_name,source_published_at)
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

export function isCurrentAffairsReady(article = {}) {
  if (hasCoachingSource(article)) return true;

  const prelims = String(article.prelims || "").trim();
  const mains = String(article.mains || "").trim();
  const syllabus = String(article.syllabus_linkage || "").trim();

  return prelims.length >= 60 && mains.length >= 100 && syllabus.length >= 20;
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

function dedupeStream(rows = []) {
  const kept = [];
  for (const article of rows) {
    const duplicate = kept.some((existing) =>
      isSameEvent(
        { title: article.title, description: article.why_news, publishedAt: article.created_at },
        { title: existing.title, description: existing.why_news, publishedAt: existing.created_at }
      )
    );
    if (!duplicate) kept.push(article);
  }
  return kept;
}

function prepareNewsRows(rows = []) {
  return dedupeStream(
    rows
      .filter((article) =>
        hasNewsSource(article) &&
        (hasNewsPresentation(article) || isDisplayWorthyNews(article))
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

/**
 * Load news from the NEWS source relation directly. This prevents older News
 * from disappearing when a large number of newer coaching/current-affairs
 * rows occupy the global latest-articles window.
 */
export async function loadNewsArticles({ limit = 48, offset = 0 } = {}) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 48, 200));
  const safeOffset = Math.max(0, Number(offset) || 0);

  const { data, error, count } = await supabase
    .from("articles")
    .select(NEWS_STREAM_FIELDS, { count: "exact" })
    .eq("status", "published")
    .eq("article_sources.source_kind", "news")
    .order("created_at", { ascending: false })
    .range(safeOffset, safeOffset + safeLimit - 1);

  if (error) {
    console.error("News stream fetch failed:", error.message);
    return { articles: [], total: 0, error };
  }

  return {
    articles: prepareNewsRows(data || []),
    total: Number(count || 0),
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
