import { createServerSupabase } from "@/lib/supabase-server";
import { SITE_URL } from "@/lib/siteUrl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function escapeXml(value = "") {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/\s+/g, " ")
    .trim();
}

export async function GET() {
  const { data, error } = await createServerSupabase()
    .from("articles")
    .select("title,slug,why_news,category,created_at,updated_at")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) console.error("[RSS] Article fetch failed:", error.message);

  const items = (data || []).map((article) => {
    const link = `${SITE_URL}/current-affairs/${article.slug}`;
    return `<item>
  <title>${escapeXml(article.title)}</title>
  <link>${escapeXml(link)}</link>
  <guid isPermaLink="true">${escapeXml(link)}</guid>
  <description>${escapeXml(article.why_news)}</description>
  <category>${escapeXml(article.category || "UPSC Current Affairs")}</category>
  <pubDate>${new Date(article.created_at).toUTCString()}</pubDate>
</item>`;
  });

  const latest = data?.[0]?.updated_at || data?.[0]?.created_at || new Date().toISOString();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>CurrentPulse AI — UPSC Current Affairs</title>
  <link>${SITE_URL}</link>
  <description>Selection-oriented daily UPSC current affairs with current-static linkage, Prelims facts and Mains analysis.</description>
  <language>en-IN</language>
  <lastBuildDate>${new Date(latest).toUTCString()}</lastBuildDate>
${items.join("\n")}
</channel></rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
