import { after, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import {
  attachNewsPresentationToExistingArticle,
  enrichPublishedArticle,
  promotePublishedNewsToCurrentAffairs,
  publishArticle,
} from "@/lib/publisher/publishArticle";
import { generateDailyQuiz } from "@/lib/quiz/generateDailyQuiz";
import { recordArticleSources } from "@/lib/coverage/sourceRegistry";
import {
  toCoveragePublishingSource,
  topicWithCoverageSources,
} from "@/lib/coverage/coveragePayload";
import {
  finishAutomationRun,
  startAutomationRun,
} from "@/lib/automation/runLog";
import { isCoverageNoiseTitle } from "@/lib/coverage/noiseFilter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const HARD_STOP_MS = 280000;
const MINIMUM_NEXT_ITEM_BUDGET_MS = 45000;
const STALE_PROCESSING_MINUTES = 20;
const PROCESSING_CONCURRENCY = 3;
const MAX_TEMPORARY_AI_FAILURES_PER_RUN = 6;

function isCoverageQueueItem(item = {}) {
  return ["coaching", "coaching_enrichment"].includes(item.pipeline_kind);
}

function coverageTopicFromQueue(item = {}) {
  const references = Array.isArray(item.coverage_sources)
    ? item.coverage_sources
    : [];

  return topicWithCoverageSources(
    {
      title: item.title,
      summary: item.description,
      url: item.url,
      source: item.source,
      publishedAt: item.published_at,
      category: item.category,
      paper: item.paper,
      keywords: item.keywords,
      imageUrl: item.image_url,
      eventKey: item.coverage_event_key,
    },
    references
  );
}

async function processCoverageQueueItem(supabase, item) {
  const topic = coverageTopicFromQueue(item);
  const sourceItem = toCoveragePublishingSource(topic);

  if (!sourceItem.sourceReferences.length) {
    throw new Error(
      "Coaching queue item has no retained source references. Run coverage collection again."
    );
  }

  let result;

  if (item.target_article_id) {
    result = await enrichPublishedArticle(
      supabase,
      item.target_article_id,
      sourceItem
    );
  } else {
    result = await publishArticle(supabase, sourceItem);

    if (result.status === "duplicate") {
      result = await enrichPublishedArticle(
        supabase,
        result.articleId,
        sourceItem
      );
    }
  }

  await recordArticleSources(supabase, result.articleId, topic);
  return result;
}

async function upgradeLegacyArticles(supabase, limit = 2) {
  const { data: articles, error } = await supabase
    .from("articles")
    .select("*")
    .eq("status", "published")
    .lt("quality_version", 2)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    // This remains non-blocking until the idempotent production migration is run.
    console.error("[Queue processor] Legacy quality lookup skipped:", error.message);
    return [];
  }
  if (!articles?.length) return [];

  const settled = await Promise.allSettled(
    articles.map((article) => {
      const sourceContent = [
        article.why_news,
        article.prelims,
        article.mains,
        article.question,
      ]
        .filter(Boolean)
        .join("\n\n");

      return enrichPublishedArticle(supabase, article.id, {
        title: article.title,
        content: sourceContent,
        source: "CurrentPulse quality upgrade",
        category: article.category,
        paper: article.paper,
        trustedCoverage: true,
        generationMode: "trusted_coverage",
      });
    })
  );

  return settled.map((result, index) =>
    result.status === "fulfilled"
      ? result.value
      : {
          status: "failed",
          articleId: articles[index].id,
          title: articles[index].title,
          error: result.reason?.message || "Quality upgrade failed.",
        }
  );
}

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
  const priority = { coaching: 0, news: 1, coaching_enrichment: 2 };
  return (data || [])
    .filter((item) => !attemptedIds.has(item.id))
    .sort(
      (left, right) =>
        (priority[left.pipeline_kind || "news"] ?? 1) -
        (priority[right.pipeline_kind || "news"] ?? 1)
    )[0] || null;
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

async function markQueueRejected(supabase, queueItemId, reason) {
  const now = new Date().toISOString();
  await updateQueueItem(
    supabase,
    queueItemId,
    {
      status: "rejected",
      processing_started_at: null,
      processed_at: now,
      updated_at: now,
      error: reason,
    },
    "Queue rejection update failed"
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

async function executeQueueProcessing() {
  const startedAt = Date.now();

  const supabase = createServerSupabase();
  const results = [];
  const attemptedIds = new Set();
  const itemDurations = [];
  let stopRequested = false;
  let stoppedForRuntimeBudget = false;
  let temporaryAiFailures = 0;

  try {
    const recovered = await recoverStaleQueueItems(supabase);

    async function worker(workerNumber) {
      while (!stopRequested) {
        const averageItemDurationMs = itemDurations.length
          ? Math.round(
              itemDurations.reduce((total, duration) => total + duration, 0) /
                itemDurations.length
            )
          : MINIMUM_NEXT_ITEM_BUDGET_MS;
        const elapsed = Date.now() - startedAt;
        const expectedNextDuration = Math.max(
          MINIMUM_NEXT_ITEM_BUDGET_MS,
          Math.ceil(averageItemDurationMs * 1.25)
        );

        if (elapsed + expectedNextDuration >= HARD_STOP_MS) {
          stoppedForRuntimeBudget = true;
          break;
        }

        const queueItem = await getPendingQueueItem(supabase, attemptedIds);
        if (!queueItem) break;

        attemptedIds.add(queueItem.id);
        const claimedItem = await claimQueueItem(supabase, queueItem);
        if (!claimedItem) continue;

        const itemStartedAt = Date.now();

        try {
          if (isCoverageQueueItem(claimedItem) && isCoverageNoiseTitle(claimedItem.title)) {
            const reason = "Rejected publisher navigation, generic digest wrapper or non-article page.";
            await markQueueRejected(supabase, claimedItem.id, reason);
            results.push({
              status: "rejected",
              pipeline: claimedItem.pipeline_kind,
              worker: workerNumber,
              queueId: claimedItem.id,
              title: claimedItem.title,
              reason,
            });
            continue;
          }

          const coverageItem = isCoverageQueueItem(claimedItem);
          const published = coverageItem
            ? await processCoverageQueueItem(supabase, claimedItem)
            : await publishArticle(supabase, claimedItem);

          if (!coverageItem) {
            // Every item that reaches the news publishing queue has already
            // passed the UPSC relevance gate. Keep one database article, but
            // preserve a newsroom presentation and also build a UPSC study
            // presentation for the Current Affairs stream.
            if (published.status === "duplicate") {
              await attachNewsPresentationToExistingArticle(
                supabase,
                published.articleId,
                claimedItem
              );
            }

            const promoted = await promotePublishedNewsToCurrentAffairs(
              supabase,
              published.articleId,
              claimedItem
            );

            await markQueuePublished(supabase, claimedItem.id, published.articleId);
            results.push({
              status: "dual_stream",
              pipeline: "news+current_affairs",
              worker: workerNumber,
              queueId: claimedItem.id,
              articleId: published.articleId,
              title: published.title,
              slug: published.slug,
              category: promoted.category || published.category,
              paper: promoted.paper || published.paper,
              newsStatus: published.status,
              currentAffairsStatus: promoted.status,
            });
          } else {
            await markQueuePublished(supabase, claimedItem.id, published.articleId);
            results.push({
              status:
                published.status === "published_source_brief"
                  ? "published_source_brief"
                  : published.status === "enriched"
                  ? "enriched"
                  : "published",
              pipeline: claimedItem.pipeline_kind || "coaching",
              worker: workerNumber,
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
          console.error(
            `[Queue processor] Worker ${workerNumber} failed for "${claimedItem.title}":`,
            errorMessage
          );
          const failure = await markQueueFailed(supabase, queueItem, errorMessage);

          results.push({
            status: failure.shouldRetry ? "retry_pending" : "failed",
            worker: workerNumber,
            queueId: claimedItem.id,
            title: claimedItem.title,
            error: errorMessage,
          });

          if (failure.temporaryFailure) {
            temporaryAiFailures += 1;
            // One rate-limited/model-specific item must not block the whole
            // day's coaching queue. Continue with other candidates, but stop
            // after several temporary failures so a full provider outage does
            // not hammer the AI routers for the entire 300-second window.
            if (temporaryAiFailures >= MAX_TEMPORARY_AI_FAILURES_PER_RUN) {
              stopRequested = true;
            }
          }
        } finally {
          itemDurations.push(Date.now() - itemStartedAt);
        }
      }
    }

    await Promise.all(
      Array.from({ length: PROCESSING_CONCURRENCY }, (_, index) =>
        worker(index + 1)
      )
    );

    let qualityUpgrades = [];
    if (results.length === 0 && Date.now() - startedAt < HARD_STOP_MS - 70000) {
      try {
        qualityUpgrades = await upgradeLegacyArticles(supabase, 2);
      } catch (error) {
        console.error("[Queue processor] Legacy article upgrade failed:", error?.message || error);
      }
    }

    let quiz = null;
    if (Date.now() - startedAt < HARD_STOP_MS - 60000) {
      try {
        quiz = await generateDailyQuiz(supabase);
      } catch (error) {
        console.error("[Queue processor] Daily quiz refresh skipped:", error?.message || error);
      }
    }

    const publishedCount = results.filter((item) => ["published", "published_source_brief", "dual_stream"].includes(item.status)).length;
    const dualStreamCount = results.filter((item) => item.status === "dual_stream").length;
    const enrichedCount = results.filter((item) => item.status === "enriched").length;
    const sourceBriefCount = results.filter((item) => item.status === "published_source_brief").length;
    const rejectedCount = results.filter((item) => item.status === "rejected").length;
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
        dualStream: dualStreamCount,
        enriched: enrichedCount,
        sourceBriefs: sourceBriefCount,
        rejected: rejectedCount,
        duplicate: duplicateCount,
        failed: failedCount,
        retryPending,
        temporaryAiFailures,
        concurrency: PROCESSING_CONCURRENCY,
        stoppedForRuntimeBudget,
        qualityUpgrades: qualityUpgrades.filter((item) => item.status !== "failed").length,
        quizReady: Boolean(quiz && (quiz.generated || quiz.reason === "already_ready")),
        durationMs: Date.now() - startedAt,
      },
      maintenance: { qualityUpgrades, quiz },
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

export async function GET(request) {
  if (!isAuthorised(request)) {
    return NextResponse.json(
      { success: false, message: "Unauthorised queue processing request." },
      { status: 401 }
    );
  }

  const waitForCompletion =
    new URL(request.url).searchParams.get("wait") === "1";

  if (waitForCompletion) return executeQueueProcessing();

  after(async () => {
    const runId = await startAutomationRun("process_queue");

    try {
      const response = await executeQueueProcessing();
      const payload = await response.json();

      await finishAutomationRun(runId, {
        success: Boolean(payload.success),
        summary: payload.stats || {
          processed: payload.partialResults?.length || 0,
        },
        error: payload.success ? null : payload.message,
      });
      console.log(`[Queue processor] Background run completed with HTTP ${response.status}.`);
    } catch (error) {
      await finishAutomationRun(runId, {
        success: false,
        error: error?.message || "Queue processor background run failed.",
      });
      console.error("[Queue processor] Background run failed:", error?.message || error);
    }
  });

  return NextResponse.json(
    {
      success: true,
      accepted: true,
      message: "Queue processing was accepted for background execution.",
    },
    { status: 202 }
  );
}
