import { after, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import {
  attachNewsPresentationToExistingArticle,
  enrichPublishedArticle,
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
import {
  assessNewsCandidate,
} from "@/lib/editorial/publicationSafety";
import { isSameEvent } from "@/lib/news/eventCluster";
import { cleanTrustedCoverageText } from "@/lib/coverage/contentCleaner";
import { inspectCoverageCandidate } from "@/lib/coverage/sourceSanitizer";
import { getConfiguredAiProviders } from "@/lib/ai/router";
import {
  shouldAttemptDailyQuiz,
  shouldRecoverFailedQueue,
} from "@/lib/automation/schedulePolicy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 150;

const HARD_STOP_MS = 125000;
const MINIMUM_NEXT_ITEM_BUDGET_MS = 25000;
const STALE_PROCESSING_MINUTES = 20;
const PROCESSING_CONCURRENCY = 2;
const MAX_QUEUE_ITEMS_PER_RUN = 6;
const MAX_TEMPORARY_AI_FAILURES_PER_RUN = 2;
const RETRYABLE_FAILED_LOOKBACK_HOURS = 72;
const AI_RETRY_COOLDOWN_MINUTES = 120;

function isCoverageQueueItem(item = {}) {
  return ["coaching", "coaching_enrichment"].includes(item.pipeline_kind);
}

function coverageTopicFromQueue(item = {}) {
  const references = Array.isArray(item.coverage_sources)
    ? item.coverage_sources.map((reference) => ({
        ...reference,
        summary: cleanTrustedCoverageText(
          reference?.summary || reference?.description || reference?.content || ""
        ),
      }))
    : [];

  return topicWithCoverageSources(
    {
      title: item.title,
      summary: cleanTrustedCoverageText(item.description || ""),
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

async function recoverRecentFailedItems(supabase) {
  const cutoff = new Date(Date.now() - RETRYABLE_FAILED_LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();
  const { data: failedRows, error: lookupError } = await supabase
    .from("article_queue")
    .select("id,error")
    .eq("status", "failed")
    .in("pipeline_kind", ["coaching", "coaching_enrichment", "news"])
    .gte("updated_at", cutoff)
    .limit(250);
  if (lookupError) {
    console.error("[Queue processor] Recent failed-item lookup skipped:", lookupError.message);
    return 0;
  }
  const retryIds = (failedRows || [])
    .filter((row) => /quality validation|invalid json|incomplete|gemini|openrouter|quota|rate limit|ai provider/i.test(String(row.error || "")))
    .map((row) => row.id);
  if (!retryIds.length) return 0;
  const { data, error } = await supabase
    .from("article_queue")
    .update({ status: "pending", attempts: 0, processing_started_at: null, processed_at: null,
      updated_at: now, error: "Requeued after source-grounded fallback upgrade." })
    .in("id", retryIds)
    .select("id");
  if (error) {
    console.error("[Queue processor] Recent failed-item recovery skipped:", error.message);
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
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw new Error(`Queue fetch failed: ${error.message}`);
  const priority = { coaching: -2, coaching_enrichment: -1, news: 0 };
  const retryCutoff = Date.now() - AI_RETRY_COOLDOWN_MINUTES * 60 * 1000;
  return (data || [])
    .filter((item) => !attemptedIds.has(item.id))
    .filter((item) => {
      const waitingForAi = /^Waiting for AI availability:/i.test(String(item.error || ""));
      if (!waitingForAi) return true;
      const updatedAt = new Date(item.updated_at || 0).getTime();
      return !Number.isFinite(updatedAt) || updatedAt <= retryCutoff;
    })
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

async function deferConcurrentDuplicate(supabase, claimedItem, originalQueueItem) {
  await updateQueueItem(
    supabase,
    claimedItem.id,
    {
      status: "pending",
      attempts: Number(originalQueueItem.attempts || 0),
      processing_started_at: null,
      updated_at: new Date().toISOString(),
      error: "Deferred because the same event is already being processed in this run.",
    },
    "Concurrent duplicate deferral failed"
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

async function executeQueueProcessing(maxItems = MAX_QUEUE_ITEMS_PER_RUN) {
  const startedAt = Date.now();

  const supabase = createServerSupabase();
  const results = [];
  const attemptedIds = new Set();
  const itemDurations = [];
  const activeEventItems = new Map();
  let stopRequested = false;
  let stoppedForRuntimeBudget = false;
  let temporaryAiFailures = 0;
  let claimedCount = 0;

  try {
    const recoveredStale = await recoverStaleQueueItems(supabase);
    const recoveredFailed = shouldRecoverFailedQueue()
      ? await recoverRecentFailedItems(supabase)
      : 0;
    const recovered = recoveredStale + recoveredFailed;

    async function worker(workerNumber) {
      while (!stopRequested) {
        if (claimedCount >= maxItems) break;
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
        if (claimedCount >= maxItems) break;

        claimedCount += 1;
        attemptedIds.add(queueItem.id);
        const claimedItem = await claimQueueItem(supabase, queueItem);
        if (!claimedItem) continue;

        const concurrentDuplicate = [...activeEventItems.values()].find((activeItem) =>
          isSameEvent(
            {
              title: claimedItem.title,
              description: claimedItem.description,
              publishedAt: claimedItem.published_at,
            },
            {
              title: activeItem.title,
              description: activeItem.description,
              publishedAt: activeItem.published_at,
            }
          )
        );
        if (concurrentDuplicate) {
          await deferConcurrentDuplicate(supabase, claimedItem, queueItem);
          results.push({
            status: "deferred_duplicate",
            worker: workerNumber,
            queueId: claimedItem.id,
            title: claimedItem.title,
            activeQueueId: concurrentDuplicate.id,
          });
          continue;
        }
        activeEventItems.set(claimedItem.id, claimedItem);

        const itemStartedAt = Date.now();

        try {
          const coverageSourceSafety = isCoverageQueueItem(claimedItem)
            ? inspectCoverageCandidate({
                title: claimedItem.title,
                summary: claimedItem.description,
                url: claimedItem.url,
              })
            : null;
          const newsSafety = !isCoverageQueueItem(claimedItem)
            ? assessNewsCandidate(claimedItem)
            : null;
          if (
            (isCoverageQueueItem(claimedItem) &&
              (
                isCoverageNoiseTitle(claimedItem.title) ||
                !coverageSourceSafety?.accepted
              )) ||
            (!isCoverageQueueItem(claimedItem) && !newsSafety.allowed)
          ) {
            const assessment = newsSafety;
            const reason = `Publication safety rejected this queue item: ${
              coverageSourceSafety && !coverageSourceSafety.accepted
                ? coverageSourceSafety.reason
                : assessment?.reason || "non-article page"
            }`;
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
            if (published.status === "duplicate") {
              await attachNewsPresentationToExistingArticle(
                supabase,
                published.articleId,
                claimedItem
              );
            }

            await markQueuePublished(supabase, claimedItem.id, published.articleId);
            results.push({
              status: published.status === "published_source_brief" ? "published_source_brief" : "published",
              pipeline: "news",
              worker: workerNumber,
              queueId: claimedItem.id,
              articleId: published.articleId,
              title: published.title,
              slug: published.slug,
              category: published.category,
              paper: published.paper,
              newsStatus: published.status,
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
          if (errorMessage.startsWith("PUBLICATION_BLOCKED:")) {
            await markQueueRejected(supabase, claimedItem.id, errorMessage);
            results.push({
              status: "rejected",
              worker: workerNumber,
              queueId: claimedItem.id,
              title: claimedItem.title,
              reason: errorMessage,
            });
            continue;
          }
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
          activeEventItems.delete(claimedItem.id);
          itemDurations.push(Date.now() - itemStartedAt);
        }
      }
    }

    await Promise.all(
      Array.from({ length: PROCESSING_CONCURRENCY }, (_, index) =>
        worker(index + 1)
      )
    );

    // Legacy quality upgrades no longer run inside the production queue cron.
    // They are maintenance work and previously made an otherwise empty queue expensive.
    let quiz = null;
    if (shouldAttemptDailyQuiz() && Date.now() - startedAt < HARD_STOP_MS - 45000) {
      try {
        quiz = await generateDailyQuiz(supabase);
      } catch (error) {
        console.error("[Queue processor] Scheduled daily quiz refresh skipped:", error?.message || error);
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
        aiProvidersConfigured: getConfiguredAiProviders(),
        providerOutage: temporaryAiFailures >= MAX_TEMPORARY_AI_FAILURES_PER_RUN,
        concurrency: PROCESSING_CONCURRENCY,
        claimed: claimedCount,
        maxItemsPerRun: MAX_QUEUE_ITEMS_PER_RUN,
        stoppedForRuntimeBudget,
        failedRecoveryAttempted: shouldRecoverFailedQueue(),
        aiRetryCooldownMinutes: AI_RETRY_COOLDOWN_MINUTES,
        quizAttemptWindow: shouldAttemptDailyQuiz(),
        quizReady: Boolean(quiz && (quiz.generated || quiz.reason === "already_ready")),
        durationMs: Date.now() - startedAt,
      },
      maintenance: { legacyQualityUpgrade: "disabled_in_cron", quiz },
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

  const requestUrl = new URL(request.url);
  const waitForCompletion =
    requestUrl.searchParams.get("wait") === "1";

  const limitParam = requestUrl.searchParams.get("limit");
  const requestedLimit = Number(limitParam);
  const runLimit =
    limitParam !== null &&
    limitParam.trim() !== "" &&
    Number.isInteger(requestedLimit)
      ? Math.max(1, Math.min(MAX_QUEUE_ITEMS_PER_RUN, requestedLimit))
      : MAX_QUEUE_ITEMS_PER_RUN;

  if (waitForCompletion) return executeQueueProcessing(runLimit);

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
