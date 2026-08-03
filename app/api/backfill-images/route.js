import { after, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { discoverSourceImage } from "@/lib/publisher/publishArticle";
import { getCategoryFallbackImage } from "@/lib/news/categoryImage";
import { persistRemoteArticleImage } from "@/lib/news/imageStorage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CONCURRENCY = 3;

function isAuthorised(request) {
  const secret = process.env.CRON_SECRET?.trim() || "";
  return Boolean(secret) && request.headers.get("authorization")?.trim() === `Bearer ${secret}`;
}

async function findSource(supabase, articleId, title) {
  const [queueResult, coverageResult] = await Promise.all([
    supabase
      .from("article_queue")
      .select("url,source,source_domain,title")
      .eq("article_id", articleId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("article_sources")
      .select("source_url,source_name,source_title")
      .eq("article_id", articleId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const queue = queueResult.data;
  const coverage = coverageResult.data;
  const url = queue?.url || coverage?.source_url || "";
  let sourceDomain = queue?.source_domain || "";

  if (!sourceDomain && url) {
    try {
      sourceDomain = new URL(url).hostname.replace(/^www\./, "");
    } catch {
      sourceDomain = "";
    }
  }

  return {
    title: queue?.title || coverage?.source_title || title,
    url,
    source: queue?.source || coverage?.source_name || "Current Affairs",
    sourceDomain,
  };
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
    .select("id,title,slug,category,image,image_url,created_at")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) throw new Error(`Image backfill fetch failed: ${error.message}`);

  const missing = (data || [])
    .filter((article) => !article.image && !article.image_url)
    .slice(0, limit);

  const results = await mapWithConcurrency(missing, async (article) => {
    try {
      const source = await findSource(supabase, article.id, article.title);
      const discovered = source.url ? await discoverSourceImage(source) : "";
      const selected =
        discovered || getCategoryFallbackImage(article.category, article.slug || article.title);
      const stored = await persistRemoteArticleImage(
        supabase,
        selected,
        article.slug || article.title
      );

      const { error: updateError } = await supabase
        .from("articles")
        .update({
          image: stored || selected,
          image_url: stored || selected,
          image_alt: article.title,
          image_caption: discovered
            ? source.source || "Original publisher image"
            : `${article.category || "Current affairs"} representative image`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", article.id);

      if (updateError) throw new Error(updateError.message);

      return {
        status: "updated",
        articleId: article.id,
        title: article.title,
        imageType: discovered ? "publisher" : "category_fallback",
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
        (data || []).filter((article) => !article.image && !article.image_url).length -
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
