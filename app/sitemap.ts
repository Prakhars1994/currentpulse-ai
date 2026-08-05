import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { MetadataRoute } from "next";
import { CATEGORY_ROUTES } from "@/lib/categoryRouting";
import { SITE_URL } from "@/lib/siteUrl";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { data: articles } = isSupabaseConfigured
    ? await supabase
        .from("articles")
        .select("slug,created_at,updated_at,image,image_url")
        .eq("status", "published")
    : { data: [] };

  const articleRoutes =
    articles?.map((article) => ({
      url: `${SITE_URL}/current-affairs/${article.slug}`,
      lastModified: article.updated_at || article.created_at || undefined,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })) || [];

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
    changeFrequency: path === "current-affairs" || path === "news" || path === "quiz" ? "daily" as const : "weekly" as const,
    priority: path === "current-affairs" ? 0.95 : path === "news" ? 0.9 : 0.7,
  }));

  const categoryPages = CATEGORY_ROUTES.map((category) => ({
    url: `${SITE_URL}/category/${category.slug}`,
    changeFrequency: "daily" as const,
    priority: 0.75,
  }));

  return [
    {
      url: SITE_URL,
      changeFrequency: "daily",
      priority: 1,
    },
    ...publicPages,
    ...categoryPages,
    ...articleRoutes,
  ];
}

