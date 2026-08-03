import { after, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { fetchVisionTopics } from "@/lib/coverage/adapters/vision";
import { fetchDrishtiTopics } from "@/lib/coverage/adapters/drishti";
import { fetchInsightsTopics } from "@/lib/coverage/adapters/insights";
import { fetchForumTopics } from "@/lib/coverage/adapters/forum";
import { fetchNextIasTopics } from "@/lib/coverage/adapters/nextias";
import { fetchVajiramTopics } from "@/lib/coverage/adapters/vajiram";
import { fetchIasBabaTopics } from "@/lib/coverage/adapters/iasbaba";
import { mergeCoverageTopics } from "@/lib/coverage/duplicateDetector";
import {
  getCoverageSourceReferences,
  loadMergedSourceKeys,
  recordArticleSources,
} from "@/lib/coverage/sourceRegistry";
import {
  enrichPublishedArticle,
  publishArticle,
} from "@/lib/publisher/publishArticle";
import {
  findDuplicateInArticles,
  loadRecentArticles,
} from "@/lib/news/duplicateRepository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const HARD_STOP_MS = 280000;
const MINIMUM_NEXT_PUBLISH_BUDGET_MS = 50000;
const DEFAULT_MAX_PUBLISHES_PER_RUN = 5;
const MAX_MANUAL_LIMIT = 30;

const SOURCE_ADAPTERS = {
  vision: fetchVisionTopics,
  drishti: fetchDrishtiTopics,
  insights: fetchInsightsTopics,
  forum: fetchForumTopics,
  nextias: fetchNextIasTopics,
  vajiram: fetchVajiramTopics,
  iasbaba: fetchIasBabaTopics,
};

function isAuthorised(request) {
  const configuredSecret = process.env.CRON_SECRET?.trim() || "";
  const authorization = request.headers.get("authorization")?.trim() || "";

  if (!configuredSecret) {
    console.error("[Coverage import] CRON_SECRET is missing.");
    return false;
  }

  return authorization === `Bearer ${configuredSecret}`;
}

function interleaveTopics(...groups) {
  const output = [];
  const maximumLength = Math.max(0, ...groups.map((group) => group.length));

  for (let index = 0; index < maximumLength; index += 1) {
    for (const group of groups) {
      if (group[index]) output.push(group[index]);
    }
  }

  return output;
}

function isTemporaryAiError(message = "") {
  const value = String(message).toLowerCase();
  return [
    "429", "503", "quota", "rate limit", "resource_exhausted", "unavailable",
    "high demand", "timeout", "timed out", "fetch failed",
  ].some((term) => value.includes(term));
}

function sourceSummary(references) {
  return references
    .map(
      (reference) => `
SOURCE: ${reference.sourceName}
SOURCE TITLE: ${reference.sourceTitle}
SOURCE URL: ${reference.sourceUrl}

${reference.summary}
      `.trim()
    )
    .join("\n\n----------------------------------------\n\n")
    .slice(0, 30000);
}

function topicWithSources(topic, references) {
  return {
    ...topic,
    sourceInputs: references,
    sources: references.map((reference) => reference.sourceName),
    source: references.map((reference) => reference.sourceName).join(", "),
    summary: sourceSummary(references),
  };
}

function toPublishingSource(topic) {
  const references = getCoverageSourceReferences(topic);

  return {
    title: topic.title,
    description: topic.summary,
    content: topic.summary,
    url: topic.url,
    source: topic.source || "Trusted UPSC Source",
    sourceName: topic.source || "Trusted UPSC Source",
    sourceReferences: references,
    publishedAt: topic.publishedAt,
    category: topic.category || "Polity & Governance",
    paper: topic.paper || "Prelims",
    importance: 10,
    evaluation_reason: `Selected and synthesized from ${references.length} trusted UPSC source${references.length === 1 ? "" : "s"}.`,
    keywords: Array.isArray(topic.keywords) ? topic.keywords : [],
    image_url: topic.imageUrl || null,
    trustedCoverage: true,
    generationMode: "trusted_coverage",
  };
}

async function fetchCoverageSources(requestedSource) {
  const entries = Object.entries(SOURCE_ADAPTERS).filter(
    ([sourceId]) => requestedSource === "all" || requestedSource === sourceId
  );
  const settled = await Promise.allSettled(
    entries.map(([, fetchTopics]) => fetchTopics())
  );
  const groups = [];
  const counts = {};
  const errors = {};

  settled.forEach((result, index) => {
    const sourceId = entries[index][0];

    if (result.status === "fulfilled") {
      const topics = Array.isArray(result.value) ? result.value : [];
      groups.push(topics);
      counts[sourceId] = topics.length;
      return;
    }

    groups.push([]);
    counts[sourceId] = 0;
    errors[sourceId] = result.reason?.message || "Source fetch failed.";
    console.error(`[Coverage import] ${sourceId} failed:`, errors[sourceId]);
  });

  return { groups, counts, errors };
}

async function executeCoverageImport({ requestedSource, manualLimit }) {
  const startedAt = Date.now();

  try {
    const supabase = createServerSupabase();
    const [coverage, recentArticles] = await Promise.all([
      fetchCoverageSources(requestedSource),
      loadRecentArticles(supabase, { lookbackDays: 45, limit: 900 }),
    ]);
    const topics = mergeCoverageTopics(interleaveTopics(...coverage.groups));
    const results = [];
    const operationDurations = [];
    let completedOperations = 0;
    let publishedCount = 0;
    let enrichedCount = 0;
    let aiUnavailable = false;

    for (const originalTopic of topics) {
      const duplicate = findDuplicateInArticles(
        {
          title: originalTopic.title,
          description: originalTopic.summary,
          publishedAt: originalTopic.publishedAt,
        },
        recentArticles
      );

      let topic = originalTopic;

      if (duplicate) {
        const knownSourceKeys = await loadMergedSourceKeys(supabase, duplicate.id);
        const newReferences = getCoverageSourceReferences(topic).filter(
          (reference) => !knownSourceKeys.has(reference.sourceKey)
        );

        if (newReferences.length === 0) {
          results.push({
            status: "already_merged",
            title: topic.title,
            articleId: duplicate.id,
            slug: duplicate.slug,
          });
          continue;
        }

        topic = topicWithSources(topic, newReferences);
      }

      if (completedOperations >= manualLimit || aiUnavailable) {
        results.push({ status: "waiting_for_next_run", title: topic.title });
        continue;
      }

      const averageDuration = operationDurations.length
        ? Math.round(
            operationDurations.reduce((total, duration) => total + duration, 0) /
              operationDurations.length
          )
        : MINIMUM_NEXT_PUBLISH_BUDGET_MS;
      const expectedNextDuration = Math.max(
        MINIMUM_NEXT_PUBLISH_BUDGET_MS,
        Math.ceil(averageDuration * 1.25)
      );

      if (Date.now() - startedAt + expectedNextDuration >= HARD_STOP_MS) {
        results.push({ status: "waiting_for_next_run", title: topic.title });
        continue;
      }

      const operationStartedAt = Date.now();

      try {
        if (duplicate) {
          const enriched = await enrichPublishedArticle(
            supabase,
            duplicate.id,
            toPublishingSource(topic)
          );
          await recordArticleSources(supabase, enriched.articleId, topic);
          enrichedCount += 1;
          completedOperations += 1;
          results.push({
            status: "enriched",
            sourceTitle: topic.title,
            sourceCount: getCoverageSourceReferences(topic).length,
            ...enriched,
          });
        } else {
          const published = await publishArticle(supabase, toPublishingSource(topic));

          if (published.status === "duplicate") {
            results.push({
              status: "duplicate",
              title: topic.title,
              articleId: published.articleId,
              slug: published.slug,
            });
          } else {
            await recordArticleSources(supabase, published.articleId, topic);
            publishedCount += 1;
            completedOperations += 1;
            recentArticles.unshift({
              id: published.articleId,
              title: published.title,
              slug: published.slug,
              why_news: topic.summary,
              created_at: new Date().toISOString(),
              status: "published",
            });
            results.push({
              status: "published",
              sourceTitle: topic.title,
              sourceCount: getCoverageSourceReferences(topic).length,
              ...published,
            });
          }
        }
      } catch (error) {
        console.error(
          `[Coverage import] Failed for "${topic.title}":`,
          error?.message || error
        );
        results.push({
          status: "failed",
          title: topic.title,
          error: error?.message || "Hybrid coverage publishing failed.",
        });
        aiUnavailable = isTemporaryAiError(error?.message);
      } finally {
        operationDurations.push(Date.now() - operationStartedAt);
      }
    }

    const countStatus = (status) =>
      results.filter((result) => result.status === status).length;

    return NextResponse.json({
      success: true,
      requestedSource,
      maxOperationsPerRun: manualLimit,
      sources: coverage.counts,
      sourceErrors: coverage.errors,
      fetched: Object.values(coverage.counts).reduce((total, count) => total + count, 0),
      hybridEvents: topics.length,
      published: publishedCount,
      enriched: enrichedCount,
      alreadyMerged: countStatus("already_merged"),
      duplicate: countStatus("duplicate"),
      waitingForNextRun: countStatus("waiting_for_next_run"),
      failed: countStatus("failed"),
      durationMs: Date.now() - startedAt,
      results,
    });
  } catch (error) {
    console.error("[Coverage import] Unexpected failure:", error);
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Hybrid coverage publishing failed.",
        durationMs: Date.now() - startedAt,
      },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  if (!isAuthorised(request)) {
    return NextResponse.json(
      { success: false, message: "Unauthorised coverage publishing request." },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const requestedSource = (searchParams.get("source") || "all").toLowerCase();
  const parsedLimit = Number.parseInt(searchParams.get("limit") || "", 10);
  const manualLimit = Number.isFinite(parsedLimit)
    ? Math.min(Math.max(parsedLimit, 1), MAX_MANUAL_LIMIT)
    : DEFAULT_MAX_PUBLISHES_PER_RUN;

  if (requestedSource !== "all" && !SOURCE_ADAPTERS[requestedSource]) {
    return NextResponse.json(
      {
        success: false,
        message: `Invalid source. Use all or one of: ${Object.keys(SOURCE_ADAPTERS).join(", ")}.`,
      },
      { status: 400 }
    );
  }

  const waitForCompletion = searchParams.get("wait") === "1";
  const run = () => executeCoverageImport({ requestedSource, manualLimit });

  if (waitForCompletion) return run();

  after(async () => {
    const response = await run();
    console.log(`[Coverage import] Background run completed with HTTP ${response.status}.`);
  });

  return NextResponse.json(
    {
      success: true,
      accepted: true,
      message: "Hybrid coaching coverage was accepted for background processing.",
      requestedSource,
      maxOperationsPerRun: manualLimit,
    },
    { status: 202 }
  );
}
