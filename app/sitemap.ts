import type { MetadataRoute } from "next";
import { CATEGORY_ROUTES } from "@/lib/categoryRouting";
import { SITE_URL } from "@/lib/siteUrl";
import { createServerSupabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SitemapArticle = {
  slug: string;
  created_at?: string | null;
  updated_at?: string | null;
  article_sources?: Array<{ source_kind?: string | null }> | null;
};

function staticRoutes(): MetadataRoute.Sitemap {
  const publicPages = [
    "current-affairs","news","categories","quiz","pdf","notes","pyq",
    "question-papers","videos","ai","contact","about","editorial-methodology",
    "sources-policy","ai-usage-policy","corrections-policy","privacy","terms",
    "exams","exams/results","exams/admit-cards","exams/notifications",
    "exams/answer-keys","exams/applications","exams/deadlines","exams/exam-dates",
    "exams/cut-offs","exams/counselling",
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
  ];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = staticRoutes();

  try {
    const supabase = createServerSupabase();
    const [articleResult, examResult] = await Promise.all([
      supabase
        .from("articles")
        .select("slug,created_at,updated_at,article_sources(source_kind)")
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(2500),
      supabase
        .from("exam_updates")
        .select("slug,created_at,updated_at")
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(1500),
    ]);

    const seen = new Set<string>();
    const articleRoutes: MetadataRoute.Sitemap = [];

    for (const article of (articleResult.data || []) as SitemapArticle[]) {
      if (!article?.slug) continue;
      const kinds = new Set((article.article_sources || []).map((s) => s?.source_kind));
      const lastModified = article.updated_at || article.created_at || undefined;

      if (kinds.has("coaching")) {
        const key = `ca:${article.slug}`;
        if (!seen.has(key)) {
          seen.add(key);
          articleRoutes.push({
            url: `${SITE_URL}/current-affairs/${article.slug}`,
            lastModified,
            changeFrequency: "weekly",
            priority: 0.85,
          });
        }
      }

      if (kinds.has("news")) {
        const key = `news:${article.slug}`;
        if (!seen.has(key)) {
          seen.add(key);
          articleRoutes.push({
            url: `${SITE_URL}/news/${article.slug}`,
            lastModified,
            changeFrequency: "weekly",
            priority: 0.75,
          });
        }
      }
    }

    const examRoutes: MetadataRoute.Sitemap = (examResult.data || []).map((exam: any) => ({
      url: `${SITE_URL}/exams/${exam.slug}`,
      lastModified: exam.updated_at || exam.created_at || undefined,
      changeFrequency: "daily",
      priority: 0.82,
    }));

    if (articleResult.error) console.error("[Sitemap] article query:", articleResult.error.message);
    if (examResult.error && examResult.error.code !== "42P01") {
      console.error("[Sitemap] exam query:", examResult.error.message);
    }

    return [...base, ...examRoutes, ...articleRoutes];
  } catch (error: any) {
    console.error("[Sitemap] dynamic data unavailable:", error?.message || error);
    // Never return a 503 sitemap. Static discovery remains available while
    // transient database errors recover.
    return base;
  }
}
