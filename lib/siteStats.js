import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabase";

export const loadHomepageStats = unstable_cache(
  async () => {
    const { count, error } = await supabase.from("articles").select("id", { count: "exact", head: true }).eq("status", "published");
    if (error) return { articleCount: 0 };
    return { articleCount: count || 0 };
  },
  ["currentpulse-home-stats-v1"],
  { revalidate: false, tags: ["currentpulse-articles"] }
);
