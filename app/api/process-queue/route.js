import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { publishArticle } from "@/lib/publisher/publishArticle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const HARD_STOP_MS = 280000;
const MINIMUM_NEXT_ITEM_BUDGET_MS = 45000;
const STALE_PROCESSING_MINUTES = 20;

function isAuthorised(request) {
  const configuredSecret = process.env.CRON_SECRET?.trim() || "";
  const authorization = request.headers.get("authorization")?.trim() || "";

  if (!configuredSecret) {
    console.error("[Queue processor] CRON_SECRET is missing.");
    return false;
  }

  return authorization === `Bearer ${configuredSecret}`;
}

async function recoverStaleQueueItems(supabase) {
  const cutoff = new Date(
    Date.now() - STALE_PROCESSING_MINUTES * 60 * 1000
  ).toISOString();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("article_queue")
    .update({
      status: "pending",
      processing_started_at: null,
      updated_at: now,
      error: "Recovered after an interrupted processing attempt.",
    })
    .eq("status", "processing")
    .lt("processing_started_at", cutoff)
    .select("id");

  if (error) {
    console.error("[Queue processor] Stale-item recovery failed:", error.message);
    return 0;
  }

  return data?.length || 0;
}

async function getPendingQueueItem(supabase, attemptedIds) {
  const { data, error } = await supabase
    .from("article_queue")
    .select("*")
    .eq("status", "pending")
    .lt("attempts", 3)
    .order("importance", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) throw new Error(`Queue fetch failed: ${error.message}`);
  return (data || []).find((item) => !attemptedIds.has(item.id)) || null;
}

async function claimQueueItem(supabase, queueItem) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("article_queue")
    .update({
      status: "processing",
      attempts: Number(queueItem.attempts || 0) + 1,
      processing_started_at: now,
      updated_at: now,
      error: null,
    })
    .eq("id", queueItem.id)
    .eq("status", "pending")
    .select()
    .maybeSingle();

  if (error) throw new Error(`Queue claim failed: ${error.message}`);
  return data;
}

async function updateQueueItem(supabase, queueItemId, values, errorPrefix) {
  const { error } = await supabase
    .from("article_queue")
    .update(values)
    .eq("id", queueItemId);

  if (error) throw new Error(`${errorPrefix}: ${error.message}`);
}

async function markQueueDuplicate(supabase, queueItemId, articleId) {
  const now = new Date().toISOString();
  await updateQueueItem(
    supabase,
    queueItemId,
    {
      status: "duplicate",
      article_id: articleId,
      processing_started_at: null,
      processed_at: now,
      updated_at: now,
      error: "The same event is already represented by a published article.",
    },
    "Queue duplicate update failed"
  );
}

async function markQueuePublished(supabase, queueItemId, articleId) {
  const now = new Date().toISOString();
  await updateQueueItem(
    supabase,
    queueItemId,
    {
      status: "published",
      article_id: articleId,
      processing_started_at: null,
      processed_at: now,
      updated_at: now,
      error: null,
    },
    "Queue completion update failed"
  );
}

function isTemporaryAiError(errorMessage = "") {
  const message = String(errorMessage).toLowerCase();
  return [
    "429", "503", "resource_exhausted", "unavailable", "quota", "rate limit",
    "high demand", "try again later", "temporarily unavailable", "timeout",
    "timed out", "network error", "fetch failed",
  ].some((term) => message.includes(term));
}

async function markQueueFailed(supabase, originalQueueItem, errorMessage) {
  const temporaryFailure = isTemporaryAiError(errorMessage);
  const previousAttempts = Number(originalQueueItem.attempts || 0);
  const attempts = temporaryFailure ? previousAttempts : previousAttempts + 1;
  const shouldRetry = temporaryFailure || attempts < 3;
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("article_queue")
    .update({
      status: shouldRetry ? "pending" : "failed",
      attempts,
      processing_started_at: null,
      updated_at: now,
      processed_at: shouldRetry ? null : now,
      error: temporaryFailure
        ? `Waiting for AI availability: ${errorMessage}`
        : errorMessage,
    })
    .eq("id", originalQueueItem.id);

  if (error) {
    console.error("[Queue processor] Failed to record queue error:", error.message);
  }

  return { temporaryFailure, shouldRetry, attempts };
}

export async function GET(request) {
  const startedAt = Date.now();

  if (!isAuthorised(request)) {
    return NextResponse.json(
      { success: false, message: "Unauthorised queue processing request." },
      { status: 401 }
    );
  }

  const supabase = createServerSupabase();
  const results = [];
  const attemptedIds = new Set();
  let averageItemDurationMs = MINIMUM_NEXT_ITEM_BUDGET_MS;

  try {
    const recovered = await recoverStaleQueueItems(supabase);

    while (true) {
      const elapsed = Date.now() - startedAt;
      const expectedNextDuration = Math.max(
        MINIMUM_NEXT_ITEM_BUDGET_MS,
        Math.ceil(averageItemDurationMs * 1.25)
      );

      if (elapsed + expectedNextDuration >= HARD_STOP_MS) break;

      const queueItem = await getPendingQueueItem(supabase, attemptedIds);
      if (!queueItem) break;

      const claimedItem = await claimQueueItem(supabase, queueItem);
      if (!claimedItem) continue;
      attemptedIds.add(claimedItem.id);

      const itemStartedAt = Date.now();

      try {
        const published = await publishArticle(supabase, claimedItem);

        if (published.status === "duplicate") {
          await markQueueDuplicate(supabase, claimedItem.id, published.articleId);
          results.push({
            status: "duplicate",
            queueId: claimedItem.id,
            articleId: published.articleId,
            title: published.title,
            slug: published.slug,
          });
        } else {
          await markQueuePublished(supabase, claimedItem.id, published.articleId);
          results.push({
            status: "published",
            queueId: claimedItem.id,
            articleId: published.articleId,
            title: published.title,
            slug: published.slug,
            category: published.category,
            paper: published.paper,
          });
        }
      } catch (error) {
        const errorMessage = error?.message || "Queue processing failed.";
        console.error(`[Queue processor] Failed for "${claimedItem.title}":`, errorMessage);
        const failure = await markQueueFailed(supabase, queueItem, errorMessage);

        results.push({
          status: failure.shouldRetry ? "retry_pending" : "failed",
          queueId: claimedItem.id,
          title: claimedItem.title,
          error: errorMessage,
        });

        if (failure.temporaryFailure) break;
      }

      const itemDuration = Date.now() - itemStartedAt;
      averageItemDurationMs =
        results.length === 1
          ? itemDuration
          : Math.round((averageItemDurationMs + itemDuration) / 2);
    }

    const publishedCount = results.filter((item) => item.status === "published").length;
    const duplicateCount = results.filter((item) => item.status === "duplicate").length;
    const failedCount = results.filter((item) => item.status === "failed").length;
    const retryPending = results.filter((item) => item.status === "retry_pending").length;

    return NextResponse.json({
      success: true,
      message:
        results.length > 0
          ? `Processed ${results.length} queued article candidates.`
          : "No pending article was ready for processing.",
      stats: {
        recovered,
        processed: results.length,
        published: publishedCount,
        duplicate: duplicateCount,
        failed: failedCount,
        retryPending,
        stoppedForRuntimeBudget:
          Date.now() - startedAt + MINIMUM_NEXT_ITEM_BUDGET_MS >= HARD_STOP_MS,
        durationMs: Date.now() - startedAt,
      },
      results,
    });
  } catch (error) {
    const errorMessage = error?.message || "Queue processing failed.";
    console.error("[Queue processor] Unexpected failure:", errorMessage);
    return NextResponse.json(
      {
        success: false,
        message: errorMessage,
        partialResults: results,
        durationMs: Date.now() - startedAt,
      },
      { status: 500 }
    );
  }
}
