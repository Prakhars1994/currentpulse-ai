import { NextResponse } from "next/server";
import { GENERAL_NEWS_QUERY_TERMS, NEWS_SOURCES } from "@/lib/news/sourceCatalog";
import { fetchSourceRss } from "@/lib/news/rss";
import { deduplicateArticles } from "@/lib/news/filter";
import { evaluateNews } from "@/lib/ai/evaluateNews";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DEFAULT_PER_SOURCE = 8;
const DEFAULT_AI_LIMIT = 20;
const AI_CONCURRENCY = 2;
const MINIMUM_IMPORTANCE = 5;

function clamp(value, minimum, maximum, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.floor(parsed)));
}

async function runWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runner() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex++;
      try {
        results[currentIndex] = {
          status: "fulfilled",
          value: await worker(items[currentIndex], currentIndex),
        };
      } catch (error) {
        results[currentIndex] = {
          status: "rejected",
          reason: error,
        };
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => runner())
  );
  return results;
}

async function evaluateArticles(articles, aiLimit) {
  const candidates = articles.slice(0, aiLimit);
  const settled = await runWithConcurrency(
    candidates,
    AI_CONCURRENCY,
    (article) => evaluateNews(article.title, article.description || article.title)
  );

  return candidates.map((article, index) => {
    const result = settled[index];
    if (result?.status === "fulfilled") {
      return { ...article, evaluation: result.value, evaluationError: null };
    }
    return {
      ...article,
      evaluation: null,
      evaluationError: result?.reason?.message || "AI evaluation failed",
    };
  });
}

export async function GET(request) {
  const startedAt = Date.now();
  const { searchParams } = new URL(request.url);
  const perSource = clamp(searchParams.get("perSource"), 2, 20, DEFAULT_PER_SOURCE);
  const aiLimit = clamp(searchParams.get("aiLimit"), 0, 40, DEFAULT_AI_LIMIT);
  const shouldEvaluate = searchParams.get("evaluate") !== "false" && aiLimit > 0;
  const requestedGroups = searchParams.get("groups")
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const sources = requestedGroups?.length
    ? NEWS_SOURCES.filter((source) => requestedGroups.includes(source.group))
    : NEWS_SOURCES;

  const sourceResults = await Promise.all(
    sources.map(async (source) => {
      try {
        const result = await fetchSourceRss(source, GENERAL_NEWS_QUERY_TERMS);
        return {
          source,
          articles: result.articles.slice(0, perSource),
          errors: result.errors,
          failed: false,
        };
      } catch (error) {
        return {
          source,
          articles: [],
          errors: [error?.message || "Source failed"],
          failed: true,
        };
      }
    })
  );

  const collected = sourceResults.flatMap((result) => result.articles);
  const deduplicated = deduplicateArticles(collected);
  const evaluated = shouldEvaluate
    ? await evaluateArticles(deduplicated, aiLimit)
    : deduplicated;

  const relevant = shouldEvaluate
    ? evaluated
        .filter(
          (article) =>
            article.evaluation?.relevant &&
            article.evaluation.importance >= MINIMUM_IMPORTANCE
        )
        .sort((a, b) => b.evaluation.importance - a.evaluation.importance)
    : evaluated;

  return NextResponse.json({
    success: true,
    mode: shouldEvaluate ? "collected-filtered-ranked" : "collection-only",
    note:
      "Commercial publishers are collected through headline, snippet and link feeds. Full copyrighted articles are not republished. PIB remains available through /api/fetch-todays-news.",
    stats: {
      configuredSources: NEWS_SOURCES.length + 1,
      attemptedFeedSources: sources.length,
      successfulSources: sourceResults.filter((result) => result.articles.length > 0).length,
      failedSources: sourceResults.filter((result) => result.failed).length,
      collected: collected.length,
      deduplicated: deduplicated.length,
      evaluated: shouldEvaluate ? evaluated.length : 0,
      relevant: relevant.length,
      durationMs: Date.now() - startedAt,
    },
    sourceStatus: sourceResults.map((result) => ({
      id: result.source.id,
      name: result.source.name,
      group: result.source.group,
      fetched: result.articles.length,
      errors: result.errors,
    })),
    articles: relevant,
  });
}
