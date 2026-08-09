import { supabase } from "@/lib/supabase";
import { isSameEvent } from "@/lib/news/eventCluster";

const ARTICLE_STREAM_FIELDS = `
  id,
  title,
  slug,
  category,
  paper,
  why_news,
  image,
  image_url,
  image_source_url,
  created_at,
  views,
  status,
  article_sources(source_kind,source_name)
`;

export function hasCoachingSource(article = {}) {
  return (article.article_sources || []).some(
    (source) => source?.source_kind === "coaching"
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

  return {
    currentAffairs: dedupeStream(rows.filter(hasCoachingSource)),
    news: dedupeStream(rows.filter((article) => !hasCoachingSource(article))),
    error: null,
  };
}
