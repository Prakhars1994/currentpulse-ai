import { isSameEvent } from "@/lib/news/eventCluster";

function comparisonDate(candidate) {
  const value = candidate?.publishedAt || candidate?.published_at || candidate?.pubDate;
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const ageDays = Math.abs(Date.now() - date.getTime()) / 86400000;
  return ageDays <= 7 ? date.toISOString() : null;
}

export async function loadRecentArticles(supabase, { lookbackDays = 21, limit = 500 } = {}) {
  const cutoff = new Date(Date.now() - lookbackDays * 86400000).toISOString();
  const { data, error } = await supabase
    .from("articles")
    .select("id, title, slug, why_news, created_at, status")
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Recent article duplicate check failed: ${error.message}`);
  }

  return data || [];
}

export function findDuplicateInArticles(candidate, articles = []) {
  const candidatePublishedAt = comparisonDate(candidate);

  return articles.find((article) => {
    return isSameEvent(
      {
        title: candidate?.title || "",
        description: candidate?.description || candidate?.summary || candidate?.why_news || "",
        publishedAt: candidatePublishedAt,
      },
      {
        title: article.title || "",
        description: article.why_news || "",
        publishedAt: candidatePublishedAt ? article.created_at : null,
      }
    );
  }) || null;
}

export async function findDuplicateArticle(supabase, candidate, options = {}) {
  const recentArticles = await loadRecentArticles(supabase, options);
  return findDuplicateInArticles(candidate, recentArticles);
}

export async function getExistingSlugSet(supabase, slugs = []) {
  const uniqueSlugs = [...new Set(slugs.filter(Boolean))];
  const existing = new Set();

  for (let index = 0; index < uniqueSlugs.length; index += 50) {
    const batch = uniqueSlugs.slice(index, index + 50);
    const { data, error } = await supabase.from("articles").select("slug").in("slug", batch);
    if (error) throw new Error(`Slug duplicate check failed: ${error.message}`);
    for (const row of data || []) existing.add(row.slug);
  }

  return existing;
}
