import { NextResponse } from "next/server";
import { GENERAL_NEWS_QUERY_TERMS, NEWS_SOURCES } from "@/lib/news/sourceCatalog";
import { fetchSourceRss } from "@/lib/news/rss";
import { deduplicateArticles } from "@/lib/news/filter";
import { assessNewsCandidate } from "@/lib/editorial/publicationSafety";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DEFAULT_PER_SOURCE = 100;

function clamp(value, minimum, maximum, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.floor(parsed)));
}

export async function GET(request) {
  const startedAt = Date.now();
  const { searchParams } = new URL(request.url);
  const perSource = clamp(searchParams.get("perSource"), 2, 100, DEFAULT_PER_SOURCE);
  const requestedGroups = searchParams.get("groups")
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const sources = requestedGroups?.length
    ? NEWS_SOURCES.filter((source) => requestedGroups.includes(source.group))
    : NEWS_SOURCES.filter((source) => source.newsAgenda === true);

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

  const rawCollected = sourceResults.flatMap((result) => result.articles);
  const collected = rawCollected.filter((article) => assessNewsCandidate(article).allowed);
  const deduplicated = deduplicateArticles(collected);
  return NextResponse.json({
    success: true,
    mode: "complete-fresh-feed-deduplicated",
    note:
      "Commercial publishers are collected through headline, snippet and link feeds. Full copyrighted articles are not republished. PIB remains available through /api/fetch-todays-news.",
    stats: {
      configuredSources: NEWS_SOURCES.filter((source) => source.newsAgenda === true).length,
      attemptedFeedSources: sources.length,
      successfulSources: sourceResults.filter((result) => result.articles.length > 0).length,
      failedSources: sourceResults.filter((result) => result.failed).length,
      collected: collected.length,
      rejectedAsNonNews: rawCollected.length - collected.length,
      deduplicated: deduplicated.length,
      evaluated: 0,
      relevant: deduplicated.length,
      durationMs: Date.now() - startedAt,
    },
    sourceStatus: sourceResults.map((result) => ({
      id: result.source.id,
      name: result.source.name,
      group: result.source.group,
      fetched: result.articles.length,
      errors: result.errors,
    })),
    articles: deduplicated,
  });
}
