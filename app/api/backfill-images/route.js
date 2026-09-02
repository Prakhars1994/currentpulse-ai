import { after, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { isVerifiedReusableArticleImage } from "@/lib/news/categoryImage";
import { persistRemoteArticleImage } from "@/lib/news/imageStorage";
import { isTerminalImageResolution, resolveGovernmentArticleImage } from "@/lib/news/governmentImageResolver";
import { isPublishedArticleSafe } from "@/lib/editorial/publicationSafety";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Keep this intentionally small. Image enrichment is optional and must never
// compete with publishing, readers, or normal site traffic.
const CONCURRENCY = 1;
const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 10;

function isAuthorised(request) {
  const secret = process.env.CRON_SECRET?.trim() || "";
  return Boolean(secret) && request.headers.get("authorization")?.trim() === `Bearer ${secret}`;
}

async function mapWithConcurrency(items, handler) {
  const results = new Array(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index++;
      results[current] = await handler(items[current]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, () => worker()));
  return results;
}

async function executeBackfill(limit) {
  const startedAt = Date.now();
  const supabase = createServerSupabase();
  const { data, error } = await supabase
    .from("articles")
    .select("id,title,slug,category,why_news,image,image_url,image_source_url,image_caption,image_search_query,image_resolution,created_at,article_sources(source_kind,source_url)")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(250);
  if (error) throw new Error(`Image backfill fetch failed: ${error.message}`);

  const needsReplacement = (article) => {
    const stream = (article.article_sources || []).some((source) => source?.source_kind === "coaching") ? "coverage" : "news";
    return isPublishedArticleSafe(article, { stream }) &&
      !isVerifiedReusableArticleImage(article) &&
      !isTerminalImageResolution(article.image_resolution);
  };

  const missing = (data || []).filter(needsReplacement).slice(0, limit);
  const results = await mapWithConcurrency(missing, async (article) => {
    try {
      const deadlineAt = Date.now() + 18000;
      const government = await resolveGovernmentArticleImage(article, { deadlineAt });
      const stored = government.image
        ? await persistRemoteArticleImage(supabase, government.image.url, article.slug || article.title, { deadlineAt })
        : "";

      const patch = {
        image_resolution: government.resolution,
        updated_at: new Date().toISOString(),
      };
      // Never force a fallback visual. Only write image fields when a verified
      // reusable candidate actually exists. A terminal no_safe_image result is
      // cached so future runs do not search the same article again.
      if (government.image) {
        patch.image = stored || government.image.url;
        patch.image_url = stored || government.image.url;
        patch.image_alt = article.title;
        patch.image_caption = government.image.attribution || null;
        patch.image_source_url = government.image.sourcePageUrl || null;
      }

      const { error: updateError } = await supabase.from("articles").update(patch).eq("id", article.id);
      if (updateError) throw new Error(updateError.message);
      return {
        status: government.image ? "updated" : "no_safe_image",
        articleId: article.id,
        title: article.title,
        provider: government.resolution?.provider || null,
        requestsUsed: government.resolution?.requests_used || 0,
        cached: Boolean(stored),
      };
    } catch (backfillError) {
      console.error(`[Image backfill] Failed for ${article.id}:`, backfillError?.message || backfillError);
      return { status: "failed", articleId: article.id, title: article.title, error: backfillError?.message || "Image backfill failed" };
    }
  });

  return NextResponse.json({
    success: true,
    policy: "optional-cache-first-terminal-on-miss",
    stats: {
      selected: missing.length,
      updated: results.filter((item) => item.status === "updated").length,
      noSafeImage: results.filter((item) => item.status === "no_safe_image").length,
      failed: results.filter((item) => item.status === "failed").length,
      concurrency: CONCURRENCY,
      durationMs: Date.now() - startedAt,
    },
    results,
  });
}

export async function GET(request) {
  if (!isAuthorised(request)) return NextResponse.json({ success: false, message: "Unauthorised image backfill request." }, { status: 401 });
  const requestedLimit = Number.parseInt(new URL(request.url).searchParams.get("limit") || "", 10);
  const limit = Number.isFinite(requestedLimit) ? Math.min(MAX_LIMIT, Math.max(1, requestedLimit)) : DEFAULT_LIMIT;
  if (new URL(request.url).searchParams.get("wait") === "1") return executeBackfill(limit);
  after(async () => {
    try { await executeBackfill(limit); }
    catch (error) { console.error("[Image backfill] Background run failed:", error?.message || error); }
  });
  return NextResponse.json({ success: true, accepted: true, message: `Optional image enrichment accepted for up to ${limit} articles.` }, { status: 202 });
}
