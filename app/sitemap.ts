import type { MetadataRoute } from "next";
import { unstable_cache } from "next/cache";
import { CATEGORY_ROUTES } from "@/lib/categoryRouting";
import { SITE_URL } from "@/lib/siteUrl";
import { createServerSupabase } from "@/lib/supabase-server";
import { isPublishedArticleSafe } from "@/lib/editorial/publicationSafety";
import {
  isStandaloneCurrentAffairsArticle,
  selectExamSitemapRecords,
} from "@/lib/sitemapQuality";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SitemapArticle = {
  title?: string | null;
  slug: string;
  created_at?: string | null;
  updated_at?: string | null;
  why_news?: string | null;
  syllabus_linkage?: string | null;
  india_relevance?: string | null;
  static_foundation?: string | null;
  data_examples?: string | null;
  prelims?: string | null;
  mains?: string | null;
  answer_framework?: string | null;
  question?: string | null;
  visual_summary?: string | null;
  memory_trick?: string | null;
  content?: string | null;
  seo_description?: string | null;
  quality_score?: number | null;
  quality_version?: number | null;
  article_sources?: Array<{
    source_kind?: string | null;
    source_name?: string | null;
    source_url?: string | null;
    source_published_at?: string | null;
    source_key?: string | null;
  }> | null;
};

type SitemapExam = {
  slug: string;
  title?: string | null;
  agency?: string | null;
  update_type?: string | null;
  official_url?: string | null;
  source_name?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function staticRoutes(): MetadataRoute.Sitemap {
  const publicPages = [
    "current-affairs","news","categories","quiz","mock-tests","pdf","notes","pyq",
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

const loadSitemapDatabaseRows = unstable_cache(
  async () => {
    const supabase = createServerSupabase();

    const [articleResult, examResult] = await Promise.all([
      supabase
        .from("articles")
        .select(`
          title,slug,created_at,updated_at,why_news,syllabus_linkage,india_relevance,
          static_foundation,data_examples,prelims,mains,answer_framework,question,
          visual_summary,memory_trick,content,seo_description,quality_score,quality_version,
          article_sources(source_kind,source_name,source_url,source_published_at,source_key)
        `)
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(2500),
      supabase
        .from("exam_updates")
        .select("slug,title,agency,update_type,official_url,source_name,created_at,updated_at")
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(1500),
    ]);

    return {
      articles: articleResult.data || [],
      exams: examResult.data || [],
      articleError: articleResult.error
        ? { message: articleResult.error.message, code: articleResult.error.code }
        : null,
      examError: examResult.error
        ? { message: examResult.error.message, code: examResult.error.code }
        : null,
    };
  },
  ["currentpulse-sitemap-database-v3"],
  {
    revalidate: 300,
    tags: ["currentpulse-articles", "currentpulse-exams"],
  }
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
      const isAdminPdf = sources.some((source) =>
        String(source?.source_key || "").startsWith("pdf:")
      );

      // Preserve SEO equity for the historical Current Affairs archive even
      // though new CA publishing is administrator-PDF-only. Removing already
      // published, indexable URLs from the sitemap caused Google discovery and
      // impressions to collapse. Safety/front-matter filters still apply.
      if (
        kinds.has("coaching") &&
        isStandaloneCurrentAffairsArticle(article) &&
        isPublishedArticleSafe(article, { stream: "coverage" })
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

      // News remains administrator-PDF-only. Unlike the previous PB-SHABD
      // gate, this includes the actual manual News PDFs while excluding legacy
      // automated feeds from new sitemap discovery.
      if (
        kinds.has("news") &&
        isAdminPdf &&
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
      lastModified: exam.updated_at || exam.created_at || undefined,
      changeFrequency: "daily",
      priority: 0.82,
    }));

    if (sitemapData.articleError) console.error("[Sitemap] article query:", sitemapData.articleError.message);
    if (sitemapData.examError && sitemapData.examError.code !== "42P01") {
      console.error("[Sitemap] exam query:", sitemapData.examError.message);
    }

    return [...base, ...examRoutes, ...articleRoutes];
  } catch (error: unknown) {
    console.error("[Sitemap] dynamic data unavailable:", error instanceof Error ? error.message : String(error));
    return base;
  }
}
