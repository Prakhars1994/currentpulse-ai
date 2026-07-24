import { supabase } from "@/lib/supabase";
import type { MetadataRoute } from "next";

const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL || "https://currentpulseai.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { data: articles } = await supabase
    .from("articles")
    .select("slug,updated_at");

  const articleRoutes =
    articles?.map((article) => ({
      url: `${BASE_URL}/current-affairs/${article.slug}`,
      lastModified: article.updated_at || new Date(),
    })) || [];

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
    },
    {
      url: `${BASE_URL}/current-affairs`,
      lastModified: new Date(),
    },
    ...articleRoutes,
  ];
}