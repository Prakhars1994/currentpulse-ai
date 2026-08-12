import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabase";

const CATEGORY_LIST_FIELDS = "id,title,slug,category,paper,why_news,image,image_url,image_source_url,image_caption,image_search_query,created_at,article_sources(source_kind)";

export const loadRecentCategoryCandidates = unstable_cache(
  async () => {
    const { data, error } = await supabase
      .from("articles")
      .select(CATEGORY_LIST_FIELDS)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(240);
    return { data: data || [], error: error || null };
  },
  ["currentpulse-category-candidates-v1"],
  { revalidate: 120, tags: ["currentpulse-articles", "currentpulse-current-affairs"] }
);
