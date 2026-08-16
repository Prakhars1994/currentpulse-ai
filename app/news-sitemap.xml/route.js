import { createServerSupabase } from "@/lib/supabase-server";
import { SITE_URL } from "@/lib/siteUrl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function escapeXml(value = "") {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function titleKey(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function emptySitemap() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
</urlset>`;
}

export async function GET() {
  try {
    const cutoff = new Date(
      Date.now() - 2 * 24 * 60 * 60 * 1000
    ).toISOString();

    /*
     * Google News only needs recent News URLs.
     *
     * Keep this query deliberately small:
     * - no article body
     * - no expensive publication-quality re-analysis
     * - News rows only
     * - maximum allowed News-sitemap population
     */
    const { data, error } = await createServerSupabase()
      .from("articles")
      .select(
        "title,slug,created_at,article_sources!inner(source_kind)"
      )
      .eq("status", "published")
      .eq("article_sources.source_kind", "news")
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(1000);

    if (error) {
      throw error;
    }

    const seenSlugs = new Set();
    const seenTitles = new Set();
    const urls = [];

    for (const article of data || []) {
      const slug = String(article?.slug || "").trim();
      const title = String(article?.title || "").trim();
      const createdAt = article?.created_at;
      const normalizedTitle = titleKey(title);

      if (!slug || !title || !createdAt) continue;
      if (seenSlugs.has(slug)) continue;
      if (normalizedTitle && seenTitles.has(normalizedTitle)) continue;

      seenSlugs.add(slug);

      if (normalizedTitle) {
        seenTitles.add(normalizedTitle);
      }

      urls.push(`<url>
  <loc>${escapeXml(`${SITE_URL}/news/${slug}`)}</loc>
  <news:news>
    <news:publication>
      <news:name>CurrentPulse AI</news:name>
      <news:language>en</news:language>
    </news:publication>
    <news:publication_date>${escapeXml(createdAt)}</news:publication_date>
    <news:title>${escapeXml(title)}</news:title>
  </news:news>
</url>`);

      if (urls.length >= 1000) break;
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urls.join("\n")}
</urlset>`;

    return new Response(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control":
          "public, max-age=0, s-maxage=600, stale-while-revalidate=1800",
      },
    });
  } catch (error) {
    console.error(
      "[News sitemap] generation failed:",
      error?.message || error
    );

    /*
     * Keep the endpoint structurally valid during a transient DB problem.
     * The main sitemap still exposes canonical article URLs.
     */
    return new Response(emptySitemap(), {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control":
          "public, max-age=0, s-maxage=60, stale-while-revalidate=120",
      },
    });
  }
}