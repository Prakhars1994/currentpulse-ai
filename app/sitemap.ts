import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { MetadataRoute } from "next";
import { CATEGORY_ROUTES } from "@/lib/categoryRouting";

const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL || "https://currentpulseai.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { data: articles } = isSupabaseConfigured
    ? await supabase
        .from("articles")
        .select("slug,updated_at")
        .eq("status", "published")
    : { data: [] };

  const articleRoutes =
    articles?.map((article) => ({
      url: `${BASE_URL}/current-affairs/${article.slug}`,
      lastModified: article.updated_at || new Date(),
    })) || [];

  const publicPages = [
    "current-affairs",
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
    url: `${BASE_URL}/${path}`,
    lastModified: new Date(),
  }));

  const categoryPages = CATEGORY_ROUTES.map((category) => ({
    url: `${BASE_URL}/category/${category.slug}`,
    lastModified: new Date(),
  }));

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
    },
    ...publicPages,
    ...categoryPages,
    ...articleRoutes,
  ];
}
