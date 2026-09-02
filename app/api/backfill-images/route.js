import { after, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { isVerifiedReusableArticleImage } from "@/lib/news/categoryImage";
import { persistRemoteArticleImage } from "@/lib/news/imageStorage";
import { isTerminalImageResolution, resolveGovernmentArticleImage } from "@/lib/news/governmentImageResolver";
import { isPublishedArticleSafe } from "@/lib/editorial/publicationSafety";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Optional enrichment only. Keep work tiny so it never competes with readers or publishing.
const CONCURRENCY = 1;
const DEFAULT_LIMIT = 3;
const MAX_LIMIT = 5;
const SCAN_LIMIT = 80;

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
    .limit(SCAN_LIMIT);
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
      const resolved = await resolveGovernmentArticleImage(article, { deadlineAt });
      const shouldHotlink = resolved.image?.storagePolicy === "hotlink";
      const finalUrl = resolved.image
        ? (shouldHotlink
          ? resolved.image.url
          : await persistRemoteArticleImage(supabase, resolved.image.url, article.slug || article.title, { deadlineAt }))
        : "";

      const patch = {
        image_resolution: resolved.resolution,
        updated_at: new Date().toISOString(),
      };

      if (resolved.image) {
        patch.image = finalUrl || resolved.image.url;
        patch.image_url = finalUrl || resolved.image.url;
        patch.image_alt = resolved.image.alt || article.title;
        patch.image_caption = resolved.image.attribution || null;
        patch.image_source_url = resolved.image.sourcePageUrl || null;
        patch.image_search_query = article.image_search_query || article.title;
      }

      const { error: updateError } = await supabase.from("articles").update(patch).eq("id", article.id);
      if (updateError) throw new Error(updateError.message);
      return {
        status: resolved.image ? "updated" : "no_safe_image",
        articleId: article.id,
        title: article.title,
        provider: resolved.resolution?.provider || null,
        requestsUsed: resolved.resolution?.requests_used || 0,
        storage: resolved.image ? (shouldHotlink ? "hotlink" : "cached") : "none",
      };
    } catch (backfillError) {
      console.error(`[Image backfill] Failed for ${article.id}:`, backfillError?.message || backfillError);
      return { status: "failed", articleId: article.id, title: article.title, error: backfillError?.message || "Image backfill failed" };
    }
  });

  return NextResponse.json({
    success: true,
    policy: "existing-first-wikimedia-first-official-fallback-terminal-on-miss",
    stats: {
      scanned: (data || []).length,
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
