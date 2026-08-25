const EDITORIAL_SOURCE_NAME = "CurrentPulse Editorial";

export function normalizeAdminStream(value) {
  return value === "news" ? "news" : "coverage";
}

export function sourceKindForStream(stream) {
  return normalizeAdminStream(stream) === "news" ? "news" : "coaching";
}

export function inferAdminStream(article) {
  const sources = Array.isArray(article?.article_sources)
    ? article.article_sources
    : [];
  return sources.some((source) => source?.source_kind === "news")
    ? "news"
    : "coverage";
}

export async function ensureArticleStream(supabase, article, stream) {
  const sourceKind = sourceKindForStream(stream);
  const oppositeKind = sourceKind === "news" ? "coaching" : "news";
  const { data: sources, error: lookupError } = await supabase
    .from("article_sources")
    .select("id,source_kind,source_name")
    .eq("article_id", article.id)
    .in("source_kind", ["coaching", "news"]);

  if (lookupError) throw lookupError;

  const rows = sources || [];
  const target = rows.find((row) => row.source_kind === sourceKind);
  const opposite = rows.find((row) => row.source_kind === oppositeKind);
  const now = new Date().toISOString();

  if (target) {
    if (target.source_name === EDITORIAL_SOURCE_NAME) {
      const { error } = await supabase
        .from("article_sources")
        .update({ updated_at: now })
        .eq("id", target.id);
      if (error) throw error;
    }
  } else if (opposite) {
    const update = { source_kind: sourceKind, updated_at: now };
    if (!opposite.source_name || opposite.source_name === EDITORIAL_SOURCE_NAME) {
      update.source_name = EDITORIAL_SOURCE_NAME;
    }
    const { error } = await supabase
      .from("article_sources")
      .update(update)
      .eq("id", opposite.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("article_sources").insert([{
      article_id: article.id,
      source_kind: sourceKind,
      source_name: EDITORIAL_SOURCE_NAME,
      source_title: article.title,
      source_published_at: article.updated_at || article.created_at || now,
      updated_at: now,
    }]);
    if (error) throw error;
  }

  const keepId = target?.id || opposite?.id;
  for (const duplicate of rows.filter((row) =>
    row.id !== keepId && row.source_kind !== sourceKind
  )) {
    const { error } = await supabase
      .from("article_sources")
      .delete()
      .eq("id", duplicate.id);
    if (error) throw error;
  }

  return sourceKind;
}

export { EDITORIAL_SOURCE_NAME };
