import { createServerSupabase } from "@/lib/supabase-server";
import { SITE_URL, absoluteSiteUrl } from "@/lib/siteUrl";

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

export async function GET() {
  const cutoff = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await createServerSupabase()
    .from("articles")
    .select("title,slug,created_at,updated_at,image,image_url")
    .eq("status", "published")
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) console.error("[News sitemap] Article fetch failed:", error.message);

  const urls = (data || []).map((article) => {
    const image = article.image || article.image_url;
    return `<url>
  <loc>${escapeXml(`${SITE_URL}/current-affairs/${article.slug}`)}</loc>
  <news:news>
    <news:publication><news:name>CurrentPulse AI</news:name><news:language>en</news:language></news:publication>
    <news:publication_date>${escapeXml(article.created_at)}</news:publication_date>
    <news:title>${escapeXml(article.title)}</news:title>
  </news:news>
  ${image ? `<image:image><image:loc>${escapeXml(absoluteSiteUrl(image))}</image:loc><image:title>${escapeXml(article.title)}</image:title></image:image>` : ""}
</url>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
