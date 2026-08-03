import { after, NextResponse } from "next/server";

import { generateStudyAids } from "@/lib/ai/generateStudyAids";
import { isVerifiedReusableArticleImage } from "@/lib/news/categoryImage";
import { persistRemoteArticleImage } from "@/lib/news/imageStorage";
import { findRelevantCommonsImage } from "@/lib/news/relevantImage";
import { createServerSupabase } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isAuthorised(request) {
  const secret = process.env.CRON_SECRET?.trim() || "";
  return Boolean(secret) && request.headers.get("authorization")?.trim() === `Bearer ${secret}`;
}

async function execute(limit) {
  const startedAt = Date.now();
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("articles")
    .select("id,title,slug,category,why_news,prelims,mains,image,image_url,image_source_url,image_search_query,visual_summary,memory_trick,map_locations,created_at")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw new Error(`Study-aid source fetch failed: ${error.message}`);

  const selected = (data || [])
    .filter(
      (article) =>
        !article.image_search_query ||
        !article.visual_summary ||
        !article.memory_trick ||
        !Array.isArray(article.map_locations) ||
        !isVerifiedReusableArticleImage(article)
    )
    .slice(0, limit);
  if (!selected.length) {
    return NextResponse.json({ success: true, stats: { selected: 0, updated: 0, remaining: 0 } });
  }

  const generated = await generateStudyAids(selected);
  const originalById = new Map(selected.map((article) => [Number(article.id), article]));
  const results = [];

  for (const item of generated) {
    const article = originalById.get(item.articleId);
    if (!article) continue;
    try {
      const currentImage = isVerifiedReusableArticleImage(article)
        ? article.image || article.image_url || ""
        : "";
      const replaceImage = !currentImage;
      const commons = replaceImage
        ? await findRelevantCommonsImage(item.imageSearchQuery, article.title)
        : null;
      const stored = commons
        ? await persistRemoteArticleImage(supabase, commons.url, article.slug || article.title)
        : currentImage;

      const { error: updateError } = await supabase
        .from("articles")
        .update({
          image_search_query: item.imageSearchQuery,
          visual_summary: item.visualSummary,
          memory_trick: item.memoryTrick,
          map_locations: item.mapLocations,
          ...(commons
            ? {
                image: stored || commons.url,
                image_url: stored || commons.url,
                image_alt: article.title,
                image_caption: commons.caption,
                image_source_url: commons.sourceUrl,
              }
            : replaceImage
              ? {
                  image: null,
                  image_url: null,
                  image_alt: article.title,
                  image_caption: null,
                  image_source_url: null,
                }
              : {}),
          updated_at: new Date().toISOString(),
        })
        .eq("id", article.id);
      if (updateError) throw new Error(updateError.message);
      results.push({
        status: "updated",
        articleId: article.id,
        image: commons
          ? "wikimedia_commons"
          : currentImage
            ? "preserved_licensed"
            : "currentpulse_article_visual",
      });
    } catch (updateFailure) {
      results.push({ status: "failed", articleId: article.id, error: updateFailure?.message || "Update failed" });
    }
  }

  return NextResponse.json({
    success: true,
    stats: {
      selected: selected.length,
      updated: results.filter((item) => item.status === "updated").length,
      failed: results.filter((item) => item.status === "failed").length,
      remainingEstimate: Math.max(
        0,
        (data || []).filter(
          (article) =>
            !article.memory_trick ||
            !article.visual_summary ||
            !isVerifiedReusableArticleImage(article)
        ).length - results.filter((item) => item.status === "updated").length
      ),
      durationMs: Date.now() - startedAt,
    },
    results,
  });
}

export async function GET(request) {
  if (!isAuthorised(request)) {
    return NextResponse.json({ success: false, message: "Unauthorised study-aid request." }, { status: 401 });
  }
  const params = new URL(request.url).searchParams;
  const requested = Number.parseInt(params.get("limit") || "", 10);
  const limit = Number.isFinite(requested) ? Math.min(20, Math.max(1, requested)) : 12;
  if (params.get("wait") === "1") return execute(limit);

  after(async () => {
    try {
      const response = await execute(limit);
      console.log(`[Study aids] Background run completed with HTTP ${response.status}.`);
    } catch (error) {
      console.error("[Study aids] Background run failed:", error?.message || error);
    }
  });
  return NextResponse.json(
    { success: true, accepted: true, message: `Study-aid backfill accepted for up to ${limit} articles.` },
    { status: 202 }
  );
}
