import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabase";

function indiaDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export const loadHomepageStats = unstable_cache(
  async () => {
    const day = indiaDateString();
    const start = new Date(`${day}T00:00:00+05:30`).toISOString();

    const [caResult, newsResult, latestResult] = await Promise.all([
      supabase
        .from("articles")
        .select("id,article_sources!inner(source_kind)", { count: "exact", head: true })
        .eq("status", "published")
        .eq("article_sources.source_kind", "coaching")
        .gte("created_at", start),
      supabase
        .from("articles")
        .select("id,article_sources!inner(source_kind)", { count: "exact", head: true })
        .eq("status", "published")
        .eq("article_sources.source_kind", "news")
        .gte("created_at", start),
      supabase
        .from("articles")
        .select("created_at,updated_at")
        .eq("status", "published")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    return {
      todayCurrentAffairs: caResult.error ? 0 : caResult.count || 0,
      todayNews: newsResult.error ? 0 : newsResult.count || 0,
      lastUpdated:
        latestResult.data?.updated_at ||
        latestResult.data?.created_at ||
        null,
    };
  },
  ["currentpulse-home-freshness-v2"],
  { revalidate: false, tags: ["currentpulse-articles"] }
);
