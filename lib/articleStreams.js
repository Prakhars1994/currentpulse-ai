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

export async function loadArticleStreams(limit = 320) {
  const { data, error } = await supabase
    .from("articles")
    .select(ARTICLE_STREAM_FIELDS)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Article stream fetch failed:", error.message);
    return { currentAffairs: [], news: [], error };
  }

  const rows = data || [];

  const newsRows = rows
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
    });

  return {
    currentAffairs: dedupeStream(rows.filter(isCurrentAffairsReady)),
    news: dedupeStream(newsRows),
    error: null,
  };
}
