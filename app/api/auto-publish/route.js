import { after, NextResponse } from "next/server";
import { GENERAL_NEWS_QUERY_TERMS, NEWS_SOURCES } from "@/lib/news/sourceCatalog";
import { fetchSourceRss } from "@/lib/news/rss";
import { deduplicateArticles } from "@/lib/news/filter";
import { createServerSupabase } from "@/lib/supabase-server";
import { queueCandidate } from "@/lib/queue/queueCandidate";
import {
  findDuplicateInArticles,
  loadRecentArticles,
} from "@/lib/news/duplicateRepository";
import { classifyCategory, resolvePaper } from "@/lib/contentTaxonomy";
import { isObviousLowValueNews } from "@/lib/news/newsQuality";
import { isSameEvent } from "@/lib/news/eventCluster";
import { queueCoverageImport } from "@/lib/coverage/queueCoverageImport";
import {
  finishAutomationRun,
  startAutomationRun,
} from "@/lib/automation/runLog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const PER_SOURCE_LIMIT = 10;
const PRIORITY_ITEMS_PER_SOURCE = 5;
const MINIMUM_IMPORTANCE = 5;
const QUEUE_WRITE_CONCURRENCY = 4;

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function createSlug(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 180);
}

function isAuthorised(request) {
  const configuredSecret = process.env.CRON_SECRET?.trim() || "";
  const authorization = request.headers.get("authorization")?.trim() || "";

  if (!configuredSecret) {
    console.error("[Auto publish] CRON_SECRET is missing.");
    return false;
  }

  return authorization === `Bearer ${configuredSecret}`;
}

async function mapWithConcurrency(items, concurrency, handler) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await handler(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );
  return results;
}

function selectSourceArticles(articles, sourceId) {
  if (articles.length <= PER_SOURCE_LIMIT) return articles;

  const priority = articles.slice(0, PRIORITY_ITEMS_PER_SOURCE);
  const rotatingPool = articles.slice(PRIORITY_ITEMS_PER_SOURCE);
  const rotatingCount = PER_SOURCE_LIMIT - priority.length;
  const halfHourSlot = Math.floor(Date.now() / (30 * 60 * 1000));
  const sourceOffset = [...String(sourceId)].reduce(
    (total, character) => total + character.charCodeAt(0),
    0
  );
  const start =
    ((halfHourSlot + sourceOffset) * rotatingCount) % rotatingPool.length;
  const rotating = [];

  for (let index = 0; index < rotatingCount; index += 1) {
    rotating.push(rotatingPool[(start + index) % rotatingPool.length]);
  }

  return [...priority, ...rotating];
}

async function collectNews() {
  const sourceResults = await Promise.all(
    NEWS_SOURCES.map(async (source) => {
      try {
        const result = await fetchSourceRss(source, GENERAL_NEWS_QUERY_TERMS);
        const uniqueForSource = selectSourceArticles(
          deduplicateArticles(result.articles),
          source.id
        );

        return {
          id: source.id,
          name: source.name,
          group: source.group,
          fetched: result.articles.length,
          selected: uniqueForSource.length,
          errors: result.errors,
          articles: uniqueForSource,
        };
      } catch (error) {
        console.error(
          `[Auto publish] Source ${source.name || source.id} failed:`,
          error?.message || error
        );

        return {
          id: source.id,
          name: source.name,
          group: source.group,
          fetched: 0,
          selected: 0,
          errors: [error?.message || "Source collection failed"],
          articles: [],
        };
      }
    })
  );

  const newspaperAgenda = deduplicateArticles(
    sourceResults
      .filter((result) => result.group !== "official")
      .flatMap((result) => result.articles)
  );
  const officialItems = sourceResults
    .filter((result) => result.group === "official")
    .flatMap((result) => result.articles);

  // Official feeds verify and enrich events already identified by general
  // newspapers; routine departmental output cannot independently set News.
  for (const official of officialItems) {
    const match = newspaperAgenda.find((article) => isSameEvent(article, official));
    if (!match) continue;
    match.coverage = [...new Set([...(match.coverage || []), official.source])];
    if (official.description && !String(match.description || "").includes(official.description)) {
      match.description = `${match.description || ""}\n\nOFFICIAL VERIFICATION (${official.source}): ${official.description}`.trim().slice(0, 6500);
    }
  }

  return {
    articles: newspaperAgenda,
    sources: sourceResults.map((result) => ({
      id: result.id,
      name: result.name,
      fetched: result.fetched,
      selected: result.selected,
      errors: result.errors,
    })),
  };
}

function localEvaluation(article) {
  const text = `${article.title || ""} ${article.description || ""}`;
  const category = classifyCategory(text);
  const preliminaryScore = Number(article.preliminaryScore || 0);
  const independentCoverage = new Set(article.coverage || [article.source]).size;
  const lowValue = isObviousLowValueNews(article);
  const importance = Math.min(10, 5 + Math.min(3, preliminaryScore) + Math.min(2, independentCoverage - 1));
  const relevant = !lowValue;

  return {
    relevant,
    scope: relevant ? (article.region === "IN" ? "India" : "Global Systemic") : "Reject",
    importance: relevant ? importance : 1,
    category,
    paper: resolvePaper(category),
    reason: relevant
      ? `Selected by the general-news agenda ranker from ${independentCoverage} publisher${independentCoverage === 1 ? "" : "s"}.`
      : "Rejected as a tender, recruitment notice, routine commercial item or other low-value listing.",
    keywords: [],
  };
}

async function evaluateCandidates(supabase, articles) {
  const recentArticles = await loadRecentArticles(supabase, {
    lookbackDays: 45,
    limit: 900,
  });

  const eligible = [];
  const skipped = [];

  for (const article of articles) {
    const slug = createSlug(article.title);

    if (!slug || slug.length < 5) {
      skipped.push({ title: article.title, reason: "invalid_title" });
      continue;
    }

    const duplicate = findDuplicateInArticles(article, recentArticles);
    if (duplicate) {
      skipped.push({
        title: article.title,
        reason: "existing_event",
        articleId: duplicate.id,
      });
      continue;
    }

    eligible.push(article);
  }

  if (eligible.length === 0) {
    return { accepted: [], rejected: [], skipped, evaluationProvider: "none" };
  }

  console.log(`[Auto publish] Evaluating ${eligible.length} unique candidates.`);

  // News is a general-public product. A deterministic newsroom agenda ranker
  // avoids UPSC filtering and remains available during AI quota outages.
  const evaluations = eligible.map(localEvaluation);
  const evaluationProvider = "general_news_agenda_v1";

  const accepted = [];
  const rejected = [];

  eligible.forEach((article, index) => {
    const evaluation = evaluations[index] || localEvaluation(article);
    const candidate = { article, evaluation };

    if (
      evaluation.relevant &&
      evaluation.scope !== "Reject" &&
      evaluation.importance >= MINIMUM_IMPORTANCE
    ) {
      accepted.push(candidate);
    } else {
      rejected.push(candidate);
    }
  });

  accepted.sort((first, second) =>
    second.evaluation.importance - first.evaluation.importance
  );

  return { accepted, rejected, skipped, evaluationProvider };
}

async function writeCandidates(supabase, candidates, status) {
  return mapWithConcurrency(
    candidates,
    QUEUE_WRITE_CONCURRENCY,
    async (candidate) => {
      try {
        const result = await queueCandidate(candidate.article, candidate.evaluation, {
          supabase,
          status,
        });

        return {
          status:
            status === "rejected"
              ? result.preserved
                ? "rejected_preserved"
                : "skipped"
              : result.queued
                ? "queued"
                : "skipped",
          title: candidate.article.title,
          ...result,
        };
      } catch (error) {
        console.error(
          `[Auto publish] ${status} queue write failed for "${candidate.article.title}":`,
          error?.message || error
        );
        return {
          status: "failed",
          title: candidate.article.title,
          error: error?.message || "Queue write failed",
        };
      }
    }
  );
}

async function executeAutoPublish() {
  const startedAt = Date.now();

  try {
    const supabase = createServerSupabase();
    console.log("[Auto publish] Starting news collection.");

    const collection = await collectNews();
    const evaluated = await evaluateCandidates(supabase, collection.articles);

    const [acceptedResults, rejectedResults] = await Promise.all([
      writeCandidates(supabase, evaluated.accepted, "pending"),
      writeCandidates(supabase, evaluated.rejected, "rejected"),
    ]);

    const queued = acceptedResults.filter((result) => result.status === "queued").length;
    const rejectedPreserved = rejectedResults.filter(
      (result) => result.status === "rejected_preserved"
    ).length;
    const failed = [...acceptedResults, ...rejectedResults].filter(
      (result) => result.status === "failed"
    ).length;

    return NextResponse.json({
      success: true,
      message:
        queued > 0
          ? `${queued} important unique articles added to the publishing queue.`
          : "No new important unique articles were queued.",
      stats: {
        collected: collection.articles.length,
        evaluated: evaluated.accepted.length + evaluated.rejected.length,
        relevantCandidates: evaluated.accepted.length,
        rejectedCandidates: evaluated.rejected.length,
        rejectedPreserved,
        duplicatesOrInvalidSkipped: evaluated.skipped.length,
        queued,
        failed,
        evaluationProvider: evaluated.evaluationProvider,
        durationMs: Date.now() - startedAt,
      },
      sources: collection.sources,
      results: [...acceptedResults, ...rejectedResults],
    });
  } catch (error) {
    console.error("[Auto publish] Unexpected failure:", error);
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Unexpected automatic publishing failure.",
        durationMs: Date.now() - startedAt,
      },
      { status: 500 }
    );
  }
}

async function executeUnifiedCollection() {
  const [newsResult, coverageResult] = await Promise.allSettled([
    executeAutoPublish().then(async (response) => ({
      httpStatus: response.status,
      ...(await response.json()),
    })),
    queueCoverageImport({
      requestedSource: "all",
      maxCandidates: 200,
    }),
  ]);

  const news = newsResult.status === "fulfilled"
    ? newsResult.value
    : {
        success: false,
        message: newsResult.reason?.message || "News collection failed.",
      };
  const coverage = coverageResult.status === "fulfilled"
    ? coverageResult.value
    : {
        success: false,
        message:
          coverageResult.reason?.message || "Coaching coverage collection failed.",
      };

  return NextResponse.json({
    success: Boolean(news.success || coverage.success),
    message:
      "AI news and trusted coaching coverage collection completed independently.",
    news,
    coverage,
  });
}

export async function GET(request) {
  if (!isAuthorised(request)) {
    return NextResponse.json(
      { success: false, message: "Unauthorised automatic publishing request." },
      { status: 401 }
    );
  }

  const waitForCompletion =
    new URL(request.url).searchParams.get("wait") === "1";

  if (waitForCompletion) return executeUnifiedCollection();

  after(async () => {
    const runId = await startAutomationRun("auto_publish");

    try {
      const response = await executeUnifiedCollection();
      const payload = await response.json();
      const coverage = payload.coverage || {};
      const news = payload.news || {};

      await finishAutomationRun(runId, {
        success: Boolean(payload.success),
        summary: {
          news: {
            success: Boolean(news.success),
            collected: news.stats?.collected || 0,
            queued: news.stats?.queued || 0,
            failed: news.stats?.failed || 0,
          },
          coverage: {
            success: Boolean(coverage.success),
            sources: coverage.sources || {},
            sourceErrors: coverage.sourceErrors || {},
            fetched: coverage.fetched || 0,
            hybridEvents: coverage.hybridEvents || 0,
            queued: coverage.queued || 0,
            queueUpdated: coverage.queueUpdated || 0,
            alreadyMerged: coverage.alreadyMerged || 0,
            failed: coverage.failed || 0,
          },
        },
        error: payload.success
          ? null
          : coverage.message || news.message || "Unified collection failed.",
      });

      console.log(
        `[Auto publish] Unified background collection completed with HTTP ${response.status}.`
      );
    } catch (error) {
      await finishAutomationRun(runId, {
        success: false,
        error: error?.message || "Unified background collection failed.",
      });
      console.error("[Auto publish] Unified background collection failed:", error?.message || error);
    }
  });

  return NextResponse.json(
    {
      success: true,
      accepted: true,
      message:
        "Automatic news collection and hybrid coaching coverage were accepted for background processing.",
    },
    { status: 202 }
  );
}
