import type { MetadataRoute } from "next";
import { unstable_cache } from "next/cache";
import { CATEGORY_ROUTES } from "@/lib/categoryRouting";
import { SITE_URL } from "@/lib/siteUrl";
import { createServerSupabase } from "@/lib/supabase-server";
import { isPublishedArticleSafe, isCurrentAffairsPubliclySafe } from "@/lib/editorial/publicationSafety";
import { isPublicNewsArticle } from "@/lib/articleStreams";
import { isIndexableNewsArticle } from "@/lib/newsIndexability";
import {
  isStandaloneCurrentAffairsArticle,
  selectExamSitemapRecords,
} from "@/lib/sitemapQuality";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SitemapArticle = {
  quality_flags?: string[] | null;
  title?: string | null;
  slug: string;
  created_at?: string | null;
  updated_at?: string | null;
  article_sources?: Array<{
    source_kind?: string | null;
  }> | null;
};

type SitemapExam = {
  slug: string;
  title?: string | null;
  agency?: string | null;
  update_type?: string | null;
  official_url?: string | null;
  source_name?: string | null;
  source_published_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function staticRoutes(): MetadataRoute.Sitemap {
  const publicPages = [
    "current-affairs","current-affairs/hindi","news","categories","quiz","mock-tests","pdf","pyq",
    "question-papers","videos","contact","about","editorial-methodology",
    "sources-policy","ai-usage-policy","corrections-policy","privacy","terms",
    "exams","exams/results","exams/admit-cards","exams/notifications",
    "exams/answer-keys","exams/applications","exams/deadlines","exams/exam-dates",
    "exams/cut-offs","exams/counselling",
  ].map((path) => ({
    url: `${SITE_URL}/${path}`,
    changeFrequency:
      path === "current-affairs" || path === "current-affairs/hindi" || path === "news"
        ? ("daily" as const)
        : ("weekly" as const),
    priority:
      path === "current-affairs"
        ? 0.95
        : path === "current-affairs/hindi"
          ? 0.9
          : path === "news"
            ? 0.9
            : 0.7,
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

const loadSitemapDatabaseRows = unstable_cache(
  async () => {
    const supabase = createServerSupabase();
    const [articleResult, examResult] = await Promise.all([
      supabase
        .from("articles")
        .select(`
          title,slug,created_at,updated_at,quality_flags,
          article_sources(source_kind)
        `)
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(2500),
      supabase
        .from("exam_updates")
        .select("slug,title,agency,update_type,official_url,source_name,source_published_at,created_at,updated_at")
        .eq("status", "published")
        .not("source_published_at", "is", null)
        .order("source_published_at", { ascending: false })
        .limit(1500),
    ]);

    if (articleResult.error || examResult.error) {
      throw new Error("Sitemap data is temporarily unavailable", { cause: articleResult.error || examResult.error });
    }
    return {
      articles: articleResult.data || [],
      exams: examResult.data || [],
    };
  },
  ["currentpulse-sitemap-database-v4"],
  { revalidate: 300, tags: ["currentpulse-articles", "currentpulse-exams"] }
);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = staticRoutes();
  try {
    const sitemapData = await loadSitemapDatabaseRows();
    const seen = new Set<string>();
    const articleRoutes: MetadataRoute.Sitemap = [];

    for (const article of sitemapData.articles as SitemapArticle[]) {
      if (!article?.slug) continue;
      const sources = article.article_sources || [];
      const kinds = new Set(sources.map((source) => source?.source_kind));
      const lastModified = article.updated_at || article.created_at || undefined;

      if (
        kinds.has("coaching") &&
        isStandaloneCurrentAffairsArticle(article) &&
        isCurrentAffairsPubliclySafe(article)
      ) {
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

      if (
        kinds.has("news") &&
        isPublicNewsArticle(article) &&
        isIndexableNewsArticle(article) &&
        isPublishedArticleSafe(article, { stream: "news" })
      ) {
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

    const selectedExams = selectExamSitemapRecords(sitemapData.exams as SitemapExam[]);
    const examRoutes: MetadataRoute.Sitemap = selectedExams.included.map((exam) => ({
      url: `${SITE_URL}/exams/${exam.slug}`,
      lastModified: exam.source_published_at || exam.updated_at || exam.created_at || undefined,
      changeFrequency: "daily",
      priority: 0.82,
    }));

    return [...base, ...examRoutes, ...articleRoutes];
  } catch (error: unknown) {
    console.error("[Sitemap] dynamic data unavailable:", error instanceof Error ? error.message : String(error));
    throw error;
  }
}
