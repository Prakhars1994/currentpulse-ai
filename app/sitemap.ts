import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { MetadataRoute } from "next";
import { CATEGORY_ROUTES } from "@/lib/categoryRouting";
import { SITE_URL } from "@/lib/siteUrl";
import { generateEventKey, normalizeText } from "@/lib/news/eventCluster";
import { isDisplayWorthyNews } from "@/lib/news/newsQuality";
import { isPublishedArticleSafe } from "@/lib/editorial/publicationSafety";

// The sitemap depends on live Supabase data. Keep it out of the static-build
// prerender path so a slow database/network call cannot fail `next build`.
export const dynamic = "force-dynamic";

// Keep this comfortably below Google's 50,000 URL limit while covering the
// complete CurrentPulse article library for the foreseeable future.
const SITEMAP_ARTICLE_LIMIT = 10000;

type SitemapArticle = {
  slug: string;
  title: string;
  why_news?: string | null;
  syllabus_linkage?: string | null;
  prelims?: string | null;
  mains?: string | null;
  content?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  article_sources?: Array<{ source_kind?: string | null; source_published_at?: string | null }> | null;
};

function isCoaching(article: SitemapArticle) {
  return (article.article_sources || []).some(
    (source) => source?.source_kind === "coaching"
  );
}

function hasNewsSource(article: SitemapArticle) {
  return (article.article_sources || []).some(
    (source) => source?.source_kind === "news"
  );
}

function stableEventKey(article: SitemapArticle) {
  // Ignore short parenthetical acronyms such as "(TMZ)" so rewritten versions
  // of the same headline collapse to one sitemap entry.
  const title = String(article.title || "").replace(/\([^)]{1,16}\)/g, " ");
  return generateEventKey({
    title,
    description: article.why_news || "",
    publishedAt: article.created_at || undefined,
  });
}

/**
 * Fast O(n) sitemap dedupe.
 *
 * The previous implementation compared every article with every article and
 * regenerated event fingerprints for each comparison. With 1,000+ articles
 * that became millions of operations and pushed Next.js sitemap prerendering
 * beyond the 60-second build limit.
 */
function dedupeArticles(rows: SitemapArticle[]) {
  const kept: SitemapArticle[] = [];
  const seenTitles = new Set<string>();
  const seenEvents = new Set<string>();

  for (const article of rows) {
    if (!article?.slug || !article?.title) continue;

    const titleKey = normalizeText(article.title);
    const eventKey = stableEventKey(article);

    if (titleKey && seenTitles.has(titleKey)) continue;
    if (eventKey && seenEvents.has(eventKey)) continue;

    if (titleKey) seenTitles.add(titleKey);
    if (eventKey) seenEvents.add(eventKey);
    kept.push(article);
  }

  return kept;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { data: articles, error } = isSupabaseConfigured
    ? await supabase
        .from("articles")
        .select(
          "slug,title,why_news,syllabus_linkage,prelims,mains,content,created_at,updated_at,article_sources(source_kind,source_published_at)"
        )
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(SITEMAP_ARTICLE_LIMIT)
    : { data: [], error: null };

  if (error) {
    console.error("[Sitemap] Article fetch failed:", error.message);
  }

  const articleRoutes = dedupeArticles(
    (articles || []) as SitemapArticle[]
  ).flatMap((article) => {
    const routes: MetadataRoute.Sitemap = [];
    const currentAffairsReady = isCoaching(article) && isPublishedArticleSafe(article, { stream: "coverage" });
    const newsReady = hasNewsSource(article) && isDisplayWorthyNews(article);

    if (currentAffairsReady) {
      routes.push({
        url: `${SITE_URL}/current-affairs/${article.slug}`,
        lastModified: article.updated_at || article.created_at || undefined,
        changeFrequency: "weekly" as const,
        priority: 0.85,
      });
    }

    if (newsReady) {
      routes.push({
        url: `${SITE_URL}/news/${article.slug}`,
        lastModified: article.updated_at || article.created_at || undefined,
        changeFrequency: "weekly" as const,
        priority: 0.75,
      });
    }

    return routes;
  });

  const publicPages = [
    "current-affairs",
    "news",
    "categories",
    "quiz",
    "pdf",
    "notes",
    "pyq",
    "question-papers",
    "videos",
    "ai",
    "contact",
  ].map((path) => ({
    url: `${SITE_URL}/${path}`,
    changeFrequency:
      path === "current-affairs" || path === "news"
        ? ("daily" as const)
        : ("weekly" as const),
    priority:
      path === "current-affairs" ? 0.95 : path === "news" ? 0.9 : 0.7,
  }));

  const categoryPages = CATEGORY_ROUTES.map((category) => ({
    url: `${SITE_URL}/category/${category.slug}`,
    changeFrequency: "daily" as const,
    priority: 0.75,
  }));

  return [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    ...publicPages,
    ...categoryPages,
    ...articleRoutes,
  ];
}
