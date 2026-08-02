import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { publishArticle } from "@/lib/publisher/publishArticle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorised(request) {
  const configuredSecret =
    process.env.CRON_SECRET?.trim() || "";

  const authorization =
    request.headers.get("authorization")?.trim() || "";

  if (!configuredSecret) {
    console.error(
      "[Queue processor] CRON_SECRET is missing."
    );

    return false;
  }

  return authorization === `Bearer ${configuredSecret}`;
}

async function getPendingQueueItem(supabase) {
  const { data, error } = await supabase
    .from("article_queue")
    .select("*")
    .eq("status", "pending")
    .lt("attempts", 3)
    .order("importance", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Queue fetch failed: ${error.message}`
    );
  }

  return data;
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

  if (error) {
    throw new Error(
      `Queue claim failed: ${error.message}`
    );
  }

  return data;
}

async function markQueueDuplicate(
  supabase,
  queueItemId,
  articleId
) {
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("article_queue")
    .update({
      status: "duplicate",
      article_id: articleId,
      processing_started_at: null,
      processed_at: now,
      updated_at: now,
      error: "Generated article already exists.",
    })
    .eq("id", queueItemId);

  if (error) {
    throw new Error(
      `Queue duplicate update failed: ${error.message}`
    );
  }
}

async function markQueuePublished(
  supabase,
  queueItemId,
  articleId
) {
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("article_queue")
    .update({
      status: "published",
      article_id: articleId,
      processing_started_at: null,
      processed_at: now,
      updated_at: now,
      error: null,
    })
    .eq("id", queueItemId);

  if (error) {
    throw new Error(
      `Queue completion update failed: ${error.message}`
    );
  }
}

function isTemporaryAiError(errorMessage = "") {
  const message = String(errorMessage).toLowerCase();

  const temporaryTerms = [
    "429",
    "503",
    "resource_exhausted",
    "unavailable",
    "quota",
    "rate limit",
    "high demand",
    "try again later",
    "temporarily unavailable",
    "timeout",
    "timed out",
    "network error",
    "fetch failed",
  ];

  return temporaryTerms.some((term) =>
    message.includes(term)
  );
}

async function markQueueFailed(
  supabase,
  originalQueueItem,
  errorMessage
) {
  const temporaryFailure =
    isTemporaryAiError(errorMessage);

  /*
   * claimQueueItem already increased attempts by one.
   * originalQueueItem still contains the attempt count
   * from before the claim.
   */
  const previousAttempts = Number(
    originalQueueItem.attempts || 0
  );

  const attempts = temporaryFailure
    ? previousAttempts
    : previousAttempts + 1;

  const shouldRetry =
    temporaryFailure || attempts < 3;

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
    console.error(
      "[Queue processor] Failed to record queue error:",
      error.message
    );
  }
}

export async function GET(request) {
  const startedAt = Date.now();

  if (!isAuthorised(request)) {
    return NextResponse.json(
      {
        success: false,
        message:
          "Unauthorised queue processing request.",
      },
      { status: 401 }
    );
  }

  const supabase = createServerSupabase();
  let queueItem = null;

  try {
    queueItem = await getPendingQueueItem(supabase);

    if (!queueItem) {
      return NextResponse.json({
        success: true,
        message:
          "No pending article exists in the queue.",
        durationMs: Date.now() - startedAt,
      });
    }

    const claimedItem = await claimQueueItem(
      supabase,
      queueItem
    );

    if (!claimedItem) {
      return NextResponse.json({
        success: true,
        message:
          "The queue item was already claimed by another process.",
        durationMs: Date.now() - startedAt,
      });
    }

    const published = await publishArticle(
      supabase,
      claimedItem
    );

    if (published.status === "duplicate") {
      await markQueueDuplicate(
        supabase,
        claimedItem.id,
        published.articleId
      );

      return NextResponse.json({
        success: true,
        message:
          "Queue item skipped because the article exists.",
        result: {
          status: "duplicate",
          queueId: claimedItem.id,
          articleId: published.articleId,
          title: published.title,
          slug: published.slug,
        },
        durationMs: Date.now() - startedAt,
      });
    }

    await markQueuePublished(
      supabase,
      claimedItem.id,
      published.articleId
    );

    return NextResponse.json({
      success: true,
      message: "One queued article was published.",
      result: {
        status: "published",
        queueId: claimedItem.id,
        articleId: published.articleId,
        title: published.title,
        slug: published.slug,
        category: published.category,
        paper: published.paper,
      },
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    const errorMessage =
      error?.message || "Queue processing failed.";

    console.error(
      "[Queue processor] Processing failed:",
      errorMessage
    );

    if (queueItem) {
      await markQueueFailed(
        supabase,
        queueItem,
        errorMessage
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: errorMessage,
        durationMs: Date.now() - startedAt,
      },
      { status: 500 }
    );
  }
}