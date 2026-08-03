import { after, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { isVerifiedReusableArticleImage } from "@/lib/news/categoryImage";
import { persistRemoteArticleImage } from "@/lib/news/imageStorage";
import { findRelevantCommonsImage } from "@/lib/news/relevantImage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CONCURRENCY = 3;

function isAuthorised(request) {
  const secret = process.env.CRON_SECRET?.trim() || "";
  return Boolean(secret) && request.headers.get("authorization")?.trim() === `Bearer ${secret}`;
}

async function mapWithConcurrency(items, handler) {
  const results = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await handler(items[current]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, () => worker())
  );
  return results;
}

async function executeBackfill(limit) {
  const startedAt = Date.now();
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("articles")
    .select("id,title,slug,category,image,image_url,image_source_url,image_search_query,created_at")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) throw new Error(`Image backfill fetch failed: ${error.message}`);

  const needsReplacement = (article) => {
    return !isVerifiedReusableArticleImage(article);
  };
  const missing = (data || [])
    .filter(needsReplacement)
    .slice(0, limit);

  const results = await mapWithConcurrency(missing, async (article) => {
    try {
      const commons = await findRelevantCommonsImage(
        article.image_search_query || article.title,
        article.title
      );
      const stored = commons
        ? await persistRemoteArticleImage(
            supabase,
            commons.url,
            article.slug || article.title
          )
        : "";

      const { error: updateError } = await supabase
        .from("articles")
        .update({
          image: stored || commons?.url || null,
          image_url: stored || commons?.url || null,
          image_alt: article.title,
          image_caption: commons?.caption || null,
          image_source_url: commons?.sourceUrl || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", article.id);

      if (updateError) throw new Error(updateError.message);

      return {
        status: "updated",
        articleId: article.id,
        title: article.title,
        imageType: commons ? "wikimedia_commons" : "currentpulse_article_visual",
      };
    } catch (backfillError) {
      console.error(`[Image backfill] Failed for ${article.id}:`, backfillError?.message || backfillError);
      return {
        status: "failed",
        articleId: article.id,
        title: article.title,
        error: backfillError?.message || "Image backfill failed",
      };
    }
  });

  return NextResponse.json({
    success: true,
    stats: {
      selected: missing.length,
      updated: results.filter((item) => item.status === "updated").length,
      failed: results.filter((item) => item.status === "failed").length,
      remainingEstimate: Math.max(
        0,
        (data || []).filter(needsReplacement).length -
          results.filter((item) => item.status === "updated").length
      ),
      concurrency: CONCURRENCY,
      durationMs: Date.now() - startedAt,
    },
    results,
  });
}

export async function GET(request) {
  if (!isAuthorised(request)) {
    return NextResponse.json(
      { success: false, message: "Unauthorised image backfill request." },
      { status: 401 }
    );
  }

  const searchParams = new URL(request.url).searchParams;
  const requestedLimit = Number.parseInt(searchParams.get("limit") || "", 10);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(100, Math.max(1, requestedLimit))
    : 30;

  if (searchParams.get("wait") === "1") return executeBackfill(limit);

  after(async () => {
    try {
      const response = await executeBackfill(limit);
      console.log(`[Image backfill] Background run completed with HTTP ${response.status}.`);
    } catch (error) {
      console.error("[Image backfill] Background run failed:", error?.message || error);
    }
  });

  return NextResponse.json(
    {
      success: true,
      accepted: true,
      message: `Image backfill accepted for up to ${limit} articles.`,
    },
    { status: 202 }
  );
}
