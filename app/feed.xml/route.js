import { loadCurrentAffairsArticles, loadNewsArticles } from "@/lib/articleStreams";
import { SITE_URL } from "@/lib/siteUrl";

export const dynamic = "force-dynamic";

function xml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function description(article = {}) {
  return String(article.seo_description || article.why_news || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

export async function GET() {
  const [news, coverage] = await Promise.all([
    loadNewsArticles({ limit: 20, offset: 0 }),
    loadCurrentAffairsArticles({ limit: 20, offset: 0 }),
  ]);
  const items = [
    ...(news.articles || []).map((article) => ({ ...article, path: `/news/${article.slug}` })),
    ...(coverage.articles || []).map((article) => ({ ...article, path: `/current-affairs/${article.slug}` })),
  ]
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .slice(0, 30);

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>CurrentPulse AI — News &amp; Current Affairs</title>
<link>${SITE_URL}/</link>
<description>Source-backed News and exam-focused Current Affairs.</description>
<language>en-IN</language>
${items.map((item) => `<item><title>${xml(item.title)}</title><link>${SITE_URL}${xml(item.path)}</link><guid isPermaLink="true">${SITE_URL}${xml(item.path)}</guid><pubDate>${new Date(item.created_at || Date.now()).toUTCString()}</pubDate><description>${xml(description(item))}</description></item>`).join("\n")}
</channel></rss>`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
