import { after, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { fetchVisionTopics } from "@/lib/coverage/adapters/vision";
import { fetchDrishtiTopics } from "@/lib/coverage/adapters/drishti";
import { deduplicateCoverageTopics } from "@/lib/coverage/duplicateDetector";
import { publishArticle } from "@/lib/publisher/publishArticle";
import {
  findDuplicateInArticles,
  loadRecentArticles,
} from "@/lib/news/duplicateRepository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const HARD_STOP_MS = 280000;
const MINIMUM_NEXT_PUBLISH_BUDGET_MS = 50000;
const MAX_MANUAL_LIMIT = 30;

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

function toPublishingSource(topic) {
  return {
    title: topic.title,
    description: topic.summary,
    content: topic.summary,
    url: topic.url,
    source: topic.source || "Trusted UPSC Source",
    sourceName: topic.source || "Trusted UPSC Source",
    publishedAt: topic.publishedAt,
    category: topic.category || "Polity & Governance",
    paper: topic.paper || "Prelims",
    importance: 10,
    evaluation_reason: `Selected by trusted UPSC current-affairs source ${
      topic.source || "Trusted UPSC Source"
    }.`,
    keywords: Array.isArray(topic.keywords) ? topic.keywords : [],
    image_url: topic.imageUrl || null,
    trustedCoverage: true,
    generationMode: "trusted_coverage",
  };
}

async function executeCoverageImport({ requestedSource, manualLimit }) {
  const startedAt = Date.now();

  try {
    const supabase = createServerSupabase();

    const [visionTopics, drishtiTopics, recentArticles] = await Promise.all([
      requestedSource === "all" || requestedSource === "vision"
        ? fetchVisionTopics()
        : Promise.resolve([]),
      requestedSource === "all" || requestedSource === "drishti"
        ? fetchDrishtiTopics()
        : Promise.resolve([]),
      loadRecentArticles(supabase, { lookbackDays: 45, limit: 900 }),
    ]);

    const topics = deduplicateCoverageTopics(
      interleaveTopics(visionTopics, drishtiTopics)
    );
    const results = [];
    let publishedCount = 0;
    let averagePublishDurationMs = MINIMUM_NEXT_PUBLISH_BUDGET_MS;
    let aiUnavailable = false;

    for (const topic of topics) {
      const duplicate = findDuplicateInArticles(
        {
          title: topic.title,
          description: topic.summary,
          publishedAt: topic.publishedAt,
        },
        recentArticles
      );

      if (duplicate) {
        results.push({
          status: "already_covered",
          title: topic.title,
          articleId: duplicate.id,
          slug: duplicate.slug,
        });
        continue;
      }

      if (manualLimit !== null && publishedCount >= manualLimit) {
        results.push({ status: "waiting_for_next_run", title: topic.title });
        continue;
      }

      if (aiUnavailable) {
        results.push({ status: "waiting_for_next_run", title: topic.title });
        continue;
      }

      const expectedNextDuration = Math.max(
        MINIMUM_NEXT_PUBLISH_BUDGET_MS,
        Math.ceil(averagePublishDurationMs * 1.25)
      );

      if (Date.now() - startedAt + expectedNextDuration >= HARD_STOP_MS) {
        results.push({ status: "waiting_for_next_run", title: topic.title });
        continue;
      }

      const publishStartedAt = Date.now();

      try {
        const published = await publishArticle(supabase, toPublishingSource(topic));

        if (published.status === "duplicate") {
          results.push({
            status: "duplicate",
            title: topic.title,
            articleId: published.articleId,
            slug: published.slug,
          });
        } else {
          publishedCount += 1;
          results.push({
            status: "published",
            sourceTitle: topic.title,
            articleId: published.articleId,
            title: published.title,
            slug: published.slug,
            category: published.category,
            paper: published.paper,
          });
        }
      } catch (error) {
        console.error(
          `[Coverage import] Failed for "${topic.title}":`,
          error?.message || error
        );
        results.push({
          status: "failed",
          title: topic.title,
          error: error?.message || "Trusted coverage publishing failed.",
        });
        aiUnavailable = isTemporaryAiError(error?.message);
      }

      const publishDuration = Date.now() - publishStartedAt;
      averagePublishDurationMs =
        publishedCount <= 1
          ? publishDuration
          : Math.round((averagePublishDurationMs + publishDuration) / 2);
    }

    const countStatus = (status) =>
      results.filter((result) => result.status === status).length;

    return NextResponse.json({
      success: true,
      requestedSource,
      manualLimit,
      sources: { vision: visionTopics.length, drishti: drishtiTopics.length },
      fetched: visionTopics.length + drishtiTopics.length,
      uniqueTopics: topics.length,
      published: publishedCount,
      alreadyCovered: countStatus("already_covered"),
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
        message: error?.message || "Trusted coverage publishing failed.",
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
    : null;

  if (!["all", "vision", "drishti"].includes(requestedSource)) {
    return NextResponse.json(
      { success: false, message: "Invalid source. Use all, vision, or drishti." },
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
      message: "Trusted coverage import was accepted for background processing.",
      requestedSource,
      manualLimit,
    },
    { status: 202 }
  );
}
