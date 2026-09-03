import { after, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { requireAuthenticatedAdmin } from "@/lib/adminAuth";
import { isVerifiedReusableArticleImage } from "@/lib/news/categoryImage";
import { isSameEvent } from "@/lib/news/eventCluster";
import { isTerminalImageResolution, resolveGovernmentArticleImage } from "@/lib/news/governmentImageResolver";
import { isPublishedArticleSafe } from "@/lib/editorial/publicationSafety";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
const CONCURRENCY = 2;
const DEFAULT_LIMIT = 6;
const MAX_LIMIT = 8;
const SCAN_LIMIT = 80;
const IMAGE_BANK_LIMIT = 300;

async function isAuthorised(request) {
  const secret = process.env.CRON_SECRET?.trim() || "";
  if (Boolean(secret) && request.headers.get("authorization")?.trim() === `Bearer ${secret}`) return true;
  try {
    const auth = await requireAuthenticatedAdmin(request);
    return Boolean(auth?.ok);
  } catch {
    return false;
  }
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

function hasFlag(article, flag) {
  return Array.isArray(article.quality_flags) && article.quality_flags.includes(flag);
}

function eventShape(article = {}) {
  return {
    title: article.title || "",
    description: article.why_news || "",
    published_at: article.published_at || article.created_at || null,
  };
}

async function loadReusableImageBank(supabase) {
  const { data, error } = await supabase
    .from("articles")
    .select("id,title,category,why_news,published_at,created_at,image,image_url,image_alt,image_caption,image_source_url,image_search_query,image_resolution")
    .eq("status", "published")
    .not("image_url", "is", null)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(IMAGE_BANK_LIMIT);
  if (error) {
    console.error("Image backfill reusable bank lookup failed:", error.message);
    return [];
  }
  return (data || []).filter((article) => isVerifiedReusableArticleImage(article));
}

function findReusableEventImage(article, imageBank = []) {
  const target = eventShape(article);
  return imageBank.find((candidate) => {
    if (!candidate?.image_url && !candidate?.image) return false;
    if (article.category && candidate.category && String(article.category).trim().toLowerCase() !== String(candidate.category).trim().toLowerCase()) return false;
    return isSameEvent(target, eventShape(candidate));
  }) || null;
}

function reusableImagePatch(candidate, article) {
  const imageUrl = candidate.image_url || candidate.image;
  return {
    image: imageUrl,
    image_url: imageUrl,
    image_alt: candidate.image_alt || article.title,
    image_caption: candidate.image_caption || null,
    image_source_url: candidate.image_source_url || null,
    image_search_query: article.image_search_query || article.title,
    image_resolution: {
      status: "preserved_existing",
      provider: candidate.image_resolution?.provider || "existing_article",
      source_article_id: candidate.id,
      requests_used: 0,
      search_query: article.image_search_query || article.title,
    },
    updated_at: new Date().toISOString(),
  };
}

async function loadUnresolvedStreamRows(supabase, targetStream) {
  let query = supabase
    .from("articles")
    .select("id,title,slug,category,why_news,content,static_foundation,quality_flags,image,image_url,image_source_url,image_caption,image_search_query,image_resolution,published_at,created_at,article_sources!inner(source_kind,source_url,source_name)")
    .eq("status", "published")
    .is("image_resolution", null)
    .eq("article_sources.source_kind", targetStream === "coverage" ? "coaching" : "news")
    .order("created_at", { ascending: false })
    .limit(SCAN_LIMIT);
  const { data, error } = await query;
  if (error) throw new Error(`Image backfill fetch failed: ${error.message}`);
  return data || [];
}

async function executeBackfill(limit, targetStream = "news") {
  const startedAt = Date.now();
  const supabase = createServerSupabase();
  const [data, imageBank] = await Promise.all([
    loadUnresolvedStreamRows(supabase, targetStream),
    loadReusableImageBank(supabase),
  ]);

  const needsReplacement = (article) => {
    const hasCoaching = (article.article_sources || []).some((source) => source?.source_kind === "coaching");
    const stream = hasCoaching ? "coverage" : "news";
    const adminPdfNews = hasFlag(article, "news_pdf_import") || (article.article_sources || []).some((source) => source?.source_name === "CurrentPulse Admin News PDF");
    const safeForImage = stream === "news" ? adminPdfNews : isPublishedArticleSafe(article, { stream });
    return stream === targetStream && safeForImage && !isVerifiedReusableArticleImage(article) && !isTerminalImageResolution(article.image_resolution);
  };

  const missing = data.filter(needsReplacement).slice(0, limit);
  const results = await mapWithConcurrency(missing, async (article) => {
    try {
      const reusable = findReusableEventImage(article, imageBank);
      if (reusable) {
        const patch = reusableImagePatch(reusable, article);
        const { error: updateError } = await supabase.from("articles").update(patch).eq("id", article.id);
        if (updateError) throw new Error(updateError.message);
        imageBank.unshift({ ...article, ...patch });
        return {
          status: "reused",
          articleId: article.id,
          title: article.title,
          sourceArticleId: reusable.id,
          requestsUsed: 0,
          storage: "url_reuse",
        };
      }

      const deadlineAt = Date.now() + 12000;
      const resolved = await resolveGovernmentArticleImage(article, { deadlineAt });
      const patch = {
        image_resolution: resolved.resolution,
        image_search_query: resolved.query || resolved.resolution?.search_query || article.image_search_query || article.title,
        updated_at: new Date().toISOString(),
      };
      if (resolved.image) {
        Object.assign(patch, {
          image: resolved.image.url,
          image_url: resolved.image.url,
          image_alt: resolved.image.alt || article.title,
          image_caption: resolved.image.attribution || null,
          image_source_url: resolved.image.sourcePageUrl || null,
        });
      }
      const { error: updateError } = await supabase.from("articles").update(patch).eq("id", article.id);
      if (updateError) throw new Error(updateError.message);
      if (resolved.image) imageBank.unshift({ ...article, ...patch });
      return {
        status: resolved.image ? "updated" : "no_safe_image",
        articleId: article.id,
        title: article.title,
        provider: resolved.resolution?.provider || null,
        requestsUsed: resolved.resolution?.requests_used || 0,
        storage: resolved.image ? "source_url" : "none",
        query: resolved.query || null,
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
    policy: "reuse-first-resolve-once-persist-url",
    stream: targetStream,
    stats: {
      scanned: data.length,
      selected: missing.length,
      reused: results.filter((item) => item.status === "reused").length,
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
  if (!(await isAuthorised(request))) {
    return NextResponse.json({ success: false, message: "Unauthorised image backfill request." }, { status: 401 });
  }
  const url = new URL(request.url);
  const requestedLimit = Number.parseInt(url.searchParams.get("limit") || "", 10);
  const limit = Number.isFinite(requestedLimit) ? Math.min(MAX_LIMIT, Math.max(1, requestedLimit)) : DEFAULT_LIMIT;
  const targetStream = url.searchParams.get("stream") === "coverage" ? "coverage" : "news";
  if (url.searchParams.get("wait") === "1") return executeBackfill(limit, targetStream);
  after(async () => {
    try {
      await executeBackfill(limit, targetStream);
    } catch (error) {
      console.error("[Image backfill] Background run failed:", error?.message || error);
    }
  });
  return NextResponse.json({ success: true, accepted: true, message: `${targetStream} image enrichment accepted for up to ${limit} articles in this batch.` }, { status: 202 });
}
