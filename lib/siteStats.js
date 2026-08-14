import { createServerSupabase } from "@/lib/supabase-server";

const statsCache = globalThis.__currentPulseHomepageStatsCache || {
  expiresAt: 0,
  value: null,
};
globalThis.__currentPulseHomepageStatsCache = statsCache;

function indiaDayRange(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const day = `${values.year}-${values.month}-${values.day}`;
  const start = new Date(`${day}T00:00:00+05:30`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { day, start: start.toISOString(), end: end.toISOString() };
}

export async function loadHomepageStats() {
  if (statsCache.value && statsCache.expiresAt > Date.now()) {
    return statsCache.value;
  }

  const supabase = createServerSupabase();
  const range = indiaDayRange();

  const [todayResult, latestResult] = await Promise.all([
    supabase
      .from("articles")
      .select("id,created_at,updated_at")
      .eq("status", "published")
      .gte("created_at", range.start)
      .lt("created_at", range.end)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("articles")
      .select("id,created_at,updated_at")
      .eq("status", "published")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  let todayCurrentAffairs = 0;
  let todayNews = 0;
  const errors = [];

  if (todayResult.error) {
    errors.push(todayResult.error.message);
  } else {
    const ids = (todayResult.data || []).map((row) => row.id);
    if (ids.length) {
      const sourceResult = await supabase
        .from("article_sources")
        .select("article_id,source_kind")
        .in("article_id", ids);

      if (sourceResult.error) {
        errors.push(sourceResult.error.message);
      } else {
        const caIds = new Set();
        const newsIds = new Set();
        for (const source of sourceResult.data || []) {
          if (source.source_kind === "coaching") caIds.add(source.article_id);
          if (source.source_kind === "news") newsIds.add(source.article_id);
        }
        todayCurrentAffairs = caIds.size;
        todayNews = newsIds.size;
      }
    }
  }

  if (latestResult.error) errors.push(latestResult.error.message);

  const value = {
    todayCurrentAffairs,
    todayNews,
    lastUpdated:
      latestResult.data?.updated_at ||
      latestResult.data?.created_at ||
      null,
    date: range.day,
    error: errors.length ? errors.join("; ") : null,
  };

  statsCache.value = value;
  statsCache.expiresAt = Date.now() + 60_000;
  return value;
}
