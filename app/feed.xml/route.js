import { createServerSupabase } from "@/lib/supabase-server";
import { SITE_URL } from "@/lib/siteUrl";
import { isSameEvent } from "@/lib/news/eventCluster";
import { isPublishedArticleSafe } from "@/lib/editorial/publicationSafety";
import { isDisplayWorthyNews } from "@/lib/news/newsQuality";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RSS_QUERY_TIMEOUT_MS = 8000;

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

function rssDate(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toUTCString() : date.toUTCString();
}

function isCoaching(article = {}) {
  return (article.article_sources || []).some(
    (source) => source?.source_kind === "coaching"
  );
}

function dedupe(rows = []) {
  const kept = [];

  for (const article of rows) {
    const stream = isCoaching(article) ? "coverage" : "news";

    if (
      stream === "news"
        ? !isDisplayWorthyNews(article)
        : !isPublishedArticleSafe(article, { stream })
    ) {
      continue;
    }

    if (
      kept.some((existing) =>
        isSameEvent(
          {
            title: article.title,
            description: article.why_news || "",
            publishedAt: article.created_at,
          },
          {
            title: existing.title,
            description: existing.why_news || "",
            publishedAt: existing.created_at,
          }
        )
      )
    ) {
      continue;
    }

    kept.push(article);
  }

  return kept;
}

async function loadFeedRows() {
  let timer;

  try {
    const query = createServerSupabase()
      .from("articles")
      .select(
        "title,slug,why_news,category,created_at,updated_at,article_sources(source_kind)"
      )
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(80);

    return await Promise.race([
      query,
      new Promise((resolve) => {
        timer = setTimeout(
          () =>
            resolve({
              data: [],
              error: {
                message: `RSS query timed out after ${RSS_QUERY_TIMEOUT_MS}ms`,
              },
            }),
          RSS_QUERY_TIMEOUT_MS
        );
      }),
    ]);
  } catch (error) {
    return { data: [], error };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function GET() {
  const result = await loadFeedRows();

  if (result?.error) {
    console.error(
      "[RSS] Article fetch degraded:",
      result.error?.message || result.error
    );
  }

  let rows = [];

  try {
    rows = dedupe(result?.data || []).slice(0, 50);
  } catch (error) {
    console.error("[RSS] Feed filtering degraded:", error?.message || error);
    rows = [];
  }

  const items = rows.map((article) => {
    const section = isCoaching(article) ? "current-affairs" : "news";
    const link = `${SITE_URL}/${section}/${article.slug}`;

    return `<item>
  <title>${escapeXml(article.title)}</title><link>${escapeXml(link)}</link>
  <guid isPermaLink="true">${escapeXml(link)}</guid>
  <description>${escapeXml(article.why_news)}</description>
  <category>${escapeXml(
    article.category || (section === "news" ? "News" : "UPSC Current Affairs")
  )}</category>
  <pubDate>${rssDate(article.created_at)}</pubDate>
</item>`;
  });

  const latest =
    rows[0]?.updated_at || rows[0]?.created_at || new Date().toISOString();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title>CurrentPulse AI — News & Current Affairs</title><link>${SITE_URL}</link>
<description>Source-backed news and UPSC current affairs from CurrentPulse AI.</description>
<language>en-IN</language><lastBuildDate>${rssDate(latest)}</lastBuildDate>
${items.join("\n")}</channel></rss>`;

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control":
        "public, max-age=0, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
