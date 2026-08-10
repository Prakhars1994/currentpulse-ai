import { createServerSupabase } from "@/lib/supabase-server";
import { SITE_URL } from "@/lib/siteUrl";
import { isSameEvent } from "@/lib/news/eventCluster";
import { isDisplayWorthyNews } from "@/lib/news/newsQuality";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function escapeXml(value = "") {
  return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function hasNewsSource(article = {}) {
  return (article.article_sources || []).some((source) => source?.source_kind === "news");
}

function dedupe(rows = []) {
  const kept = [];
  for (const article of rows) {
    if (!hasNewsSource(article) || !isDisplayWorthyNews(article)) continue;
    const duplicate = kept.some((existing) => isSameEvent(
      { title: article.title, description: article.why_news || "", publishedAt: article.created_at },
      { title: existing.title, description: existing.why_news || "", publishedAt: existing.created_at }
    ));
    if (!duplicate) kept.push(article);
  }
  return kept;
}

export async function GET() {
  const cutoff = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await createServerSupabase()
    .from("articles")
    .select("title,slug,why_news,content,created_at,updated_at,article_sources(source_kind,source_published_at)")
    .eq("status", "published").gte("created_at", cutoff)
    .order("created_at", { ascending: false }).limit(1000);

  if (error) console.error("[News sitemap] Article fetch failed:", error.message);

  const urls = dedupe(data || []).map((article) => `<url>
  <loc>${escapeXml(`${SITE_URL}/news/${article.slug}`)}</loc>
  <news:news>
    <news:publication><news:name>CurrentPulse AI</news:name><news:language>en</news:language></news:publication>
    <news:publication_date>${escapeXml(article.created_at)}</news:publication_date>
    <news:title>${escapeXml(article.title)}</news:title>
  </news:news>
</url>`);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urls.join("\n")}
</urlset>`;

  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600" } });
}
