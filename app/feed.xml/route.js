import { createServerSupabase } from "@/lib/supabase-server";
import { SITE_URL } from "@/lib/siteUrl";
import { isSameEvent } from "@/lib/news/eventCluster";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function escapeXml(value = "") {
  return String(value || "").replace(/<[^>]+>/g, " ").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;").replace(/\s+/g, " ").trim();
}

function isCoaching(article = {}) {
  return (article.article_sources || []).some((source) => source?.source_kind === "coaching");
}

function dedupe(rows = []) {
  const kept = [];
  for (const article of rows) {
    if (kept.some((existing) => isSameEvent(
      { title: article.title, description: article.why_news || "", publishedAt: article.created_at },
      { title: existing.title, description: existing.why_news || "", publishedAt: existing.created_at }
    ))) continue;
    kept.push(article);
  }
  return kept;
}

export async function GET() {
  const { data, error } = await createServerSupabase()
    .from("articles")
    .select("title,slug,why_news,category,created_at,updated_at,article_sources(source_kind)")
    .eq("status", "published").order("created_at", { ascending: false }).limit(80);
  if (error) console.error("[RSS] Article fetch failed:", error.message);

  const rows = dedupe(data || []).slice(0, 50);
  const items = rows.map((article) => {
    const section = isCoaching(article) ? "current-affairs" : "news";
    const link = `${SITE_URL}/${section}/${article.slug}`;
    return `<item>
  <title>${escapeXml(article.title)}</title><link>${escapeXml(link)}</link>
  <guid isPermaLink="true">${escapeXml(link)}</guid>
  <description>${escapeXml(article.why_news)}</description>
  <category>${escapeXml(article.category || (section === "news" ? "News" : "UPSC Current Affairs"))}</category>
  <pubDate>${new Date(article.created_at).toUTCString()}</pubDate>
</item>`;
  });

  const latest = rows[0]?.updated_at || rows[0]?.created_at || new Date().toISOString();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>CurrentPulse AI — News & Current Affairs</title><link>${SITE_URL}</link>
<description>Source-backed news and UPSC current affairs from CurrentPulse AI.</description>
<language>en-IN</language><lastBuildDate>${new Date(latest).toUTCString()}</lastBuildDate>
${items.join("\n")}</channel></rss>`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600" } });
}
