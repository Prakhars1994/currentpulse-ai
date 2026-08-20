import { after, NextResponse } from "next/server";
import { GENERAL_NEWS_QUERY_TERMS, NEWS_SOURCES } from "@/lib/news/sourceCatalog";
import { fetchSourceRss } from "@/lib/news/rss";
import { deduplicateArticles } from "@/lib/news/filter";
import { createServerSupabase } from "@/lib/supabase-server";
import { publishArticle } from "@/lib/publisher/publishArticle";
import {
  findDuplicateInArticles,
  loadRecentArticles,
} from "@/lib/news/duplicateRepository";
import { classifyNewsCategory, resolvePaper } from "@/lib/contentTaxonomy";
import { isSameEvent } from "@/lib/news/eventCluster";
import {
  COVERAGE_SOURCE_IDS,
  queueCoverageImport,
} from "@/lib/coverage/queueCoverageImport";
import {
  selectScheduledCoverageSourceIds,
  selectScheduledNewsSources,
} from "@/lib/automation/schedulePolicy";
import {
  finishAutomationRun,
  startAutomationRun,
} from "@/lib/automation/runLog";
import { assessNewsCandidate } from "@/lib/editorial/publicationSafety";
import { assessNewsEditorialValue } from "@/lib/news/newsEditorialGate";
import { normalizeHistoryDate } from "@/lib/automation/history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 900;

const NEWS_PUBLISH_CONCURRENCY = Math.max(
  1,
  Math.min(12, Number(process.env.NEWS_PUBLISH_CONCURRENCY || 6))
);

const NEWS_SOURCE_FETCH_CONCURRENCY = Math.max(
  1,
  Math.min(4, Number(process.env.NEWS_SOURCE_FETCH_CONCURRENCY || 2))
);

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

function activeNewsSources() {
  const activeGroups = new Set(["indian-news", "state-news", "global-news", "official"]);
  return NEWS_SOURCES.filter((source) => activeGroups.has(source.group));
}

async function collectNews({
  full = false,
  newsBatch = 0,
  newsBatchSize = 6,
  historyDate = "",
} = {}) {
  const configuredSources = activeNewsSources();
  const scheduled = selectScheduledNewsSources(NEWS_SOURCES);
  const safeBatchSize = Math.min(
    8,
    Math.max(2, Number(newsBatchSize) || 6)
  );
  const batchCount = Math.max(
    1,
    Math.ceil(configuredSources.length / safeBatchSize)
  );
  const safeBatch = Math.min(
    batchCount - 1,
    Math.max(0, Number(newsBatch) || 0)
  );
  const batchStart = safeBatch * safeBatchSize;
  const historical = Boolean(historyDate);
  const selectedSources = full || historical
    ? configuredSources.slice(batchStart, batchStart + safeBatchSize)
    : scheduled.sources;
  const sourceResults = await mapWithConcurrency(
    selectedSources,
    NEWS_SOURCE_FETCH_CONCURRENCY,
    async (source) => {
      try {
        const result = await fetchSourceRss(source, GENERAL_NEWS_QUERY_TERMS, {
          historyDate,
        });
        const structurallyValidItems = result.articles.filter(
          (article) => assessNewsCandidate(article).allowed
        );
        const articleLikeItems = structurallyValidItems.filter(
          (article) => assessNewsEditorialValue(article).allowed
        );
        const uniqueForSource = deduplicateArticles(articleLikeItems);

        return {
          id: source.id,
          name: source.name,
          group: source.group,
          fetched: result.articles.length,
          selected: uniqueForSource.length,
          nonArticlesRejected: result.articles.length - structurallyValidItems.length,
          editorialNoiseRejected: structurallyValidItems.length - articleLikeItems.length,
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
          nonArticlesRejected: 0,
          editorialNoiseRejected: 0,
          errors: [error?.message || "Source collection failed"],
          articles: [],
        };
      }
    }
  );

  const newspaperAgenda = deduplicateArticles(
    sourceResults
      .filter((result) => result.group !== "official")
      .flatMap((result) => result.articles)
  );
  const officialItems = sourceResults
    .filter((result) => result.group === "official")
    .flatMap((result) => result.articles);

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
    selection: {
      mode: historical ? "history-batch" : full ? "full-batch" : "scheduled",
      historyDate: historyDate || null,
      configuredCount: configuredSources.length,
      selectedCount: selectedSources.length,
      selectedIds: selectedSources.map((source) => source.id),
      coreCount: full || historical ? null : scheduled.coreCount,
      supplementalCount: full || historical ? null : scheduled.supplementalCount,
      batchIndex: full || historical ? safeBatch : null,
      batchSize: full || historical ? safeBatchSize : null,
      batchCount: full || historical ? batchCount : null,
      hasMore: full || historical ? safeBatch + 1 < batchCount : false,
    },
    sources: sourceResults.map((result) => ({
      id: result.id,
      name: result.name,
      fetched: result.fetched,
      selected: result.selected,
      nonArticlesRejected: result.nonArticlesRejected,
      editorialNoiseRejected: result.editorialNoiseRejected || 0,
      errors: result.errors,
    })),
  };
}

function localEvaluation(article) {
  const text = `${article.title || ""} ${article.description || ""}`;
  const category = classifyNewsCategory(text);
  const independentCoverage = new Set(article.coverage || [article.source]).size;
  const importance = Math.min(10, 6 + Math.min(3, independentCoverage - 1));

  return {
    relevant: true,
    scope: article.region === "IN" ? "India" : "Global Systemic",
    importance,
    category,
    paper: resolvePaper(category),
    reason: `Passed the deterministic public-news gate and came from ${independentCoverage} fresh publisher${independentCoverage === 1 ? "" : "s"}; no AI importance ranking applied.`,
    keywords: [],
  };
}

async function evaluateCandidates(supabase, articles, { historyDate = "" } = {}) {
  const recentArticles = await loadRecentArticles(supabase, {
    lookbackDays: historyDate ? 62 : 14,
    limit: historyDate ? 1200 : 450,
  });

  const eligible = [];
  const skipped = [];

  for (const article of articles) {
    const safety = assessNewsCandidate(article);
    if (!safety.allowed) {
      skipped.push({ title: article.title, reason: safety.code });
      continue;
    }

    const editorial = assessNewsEditorialValue(article);
    if (!editorial.allowed) {
      skipped.push({ title: article.title, reason: editorial.code });
      continue;
    }

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

  const evaluations = eligible.map(localEvaluation);
  const accepted = eligible.map((article, index) => ({
    article,
    evaluation: evaluations[index] || localEvaluation(article),
  }));

  accepted.sort((first, second) =>
    new Date(second.article.publishedAt || 0) - new Date(first.article.publishedAt || 0)
  );

  return {
    accepted,
    rejected: [],
    skipped,
    evaluationProvider: "general_news_agenda_v2",
  };
}

async function publishCandidatesDirectly(supabase, candidates) {
  return mapWithConcurrency(
    candidates,
    NEWS_PUBLISH_CONCURRENCY,
    async (candidate) => {
      const sourceItem = {
        ...candidate.article,
        category:
          candidate.evaluation?.category ||
          candidate.article.category,
        paper:
          candidate.evaluation?.paper ||
          candidate.article.paper ||
          "Prelims",
        keywords: Array.isArray(candidate.evaluation?.keywords)
          ? candidate.evaluation.keywords
          : Array.isArray(candidate.article.keywords)
            ? candidate.article.keywords
            : [],
        generationMode: "news",
        trustedCoverage: false,
      };

      try {
        const result = await publishArticle(supabase, sourceItem);

        return {
          status:
            result.status === "duplicate"
              ? "duplicate"
              : "published",
          newsStatus: result.status,
          articleId: result.articleId,
          title: result.title || candidate.article.title,
          slug: result.slug,
          category: result.category,
          paper: result.paper,
        };
      } catch (error) {
        const message =
          error?.message || "Direct News publication failed.";

        if (message.startsWith("PUBLICATION_BLOCKED:")) {
          return {
            status: "rejected",
            title: candidate.article.title,
            reason: message,
          };
        }

        console.error(
          `[Auto publish] Direct publication failed for "${candidate.article.title}":`,
          message
        );

        return {
          status: "failed",
          title: candidate.article.title,
          error: message,
        };
      }
    }
  );
}

async function executeAutoPublish({
  full = false,
  newsBatch = 0,
  newsBatchSize = 6,
  historyDate = "",
} = {}) {
  const startedAt = Date.now();

  try {
    const supabase = createServerSupabase();
    const collection = await collectNews({
      full,
      newsBatch,
      newsBatchSize,
      historyDate,
    });
    const editorialNoiseRejected = collection.sources.reduce(
      (total, source) => total + Number(source.editorialNoiseRejected || 0),
      0
    );
    const evaluated = await evaluateCandidates(supabase, collection.articles, {
      historyDate,
    });
    const directResults = await publishCandidatesDirectly(
      supabase,
      evaluated.accepted
    );

    const published = directResults.filter(
      (result) => result.status === "published"
    ).length;

    const duplicates = directResults.filter(
      (result) => result.status === "duplicate"
    ).length;

    const rejectedAfterValidation = directResults.filter(
      (result) => result.status === "rejected"
    ).length;

    const failed = directResults.filter(
      (result) => result.status === "failed"
    ).length;

    return NextResponse.json({
      success: true,
      message:
        published > 0
          ? `${published} fresh unique newspaper articles published directly.`
          : "No new newspaper articles required publication.",
      stats: {
        collected: collection.articles.length,
        evaluated: evaluated.accepted.length + evaluated.rejected.length,
        relevantCandidates: evaluated.accepted.length,
        rejectedCandidates: evaluated.rejected.length,
        editorialNoiseRejected,
        rejectedAfterValidation,
        duplicatesOrInvalidSkipped: evaluated.skipped.length,
        deferredForNextRun: 0,
        queued: 0,
        published,
        duplicates,
        failed,
        directPublishConcurrency: NEWS_PUBLISH_CONCURRENCY,
        evaluationProvider: evaluated.evaluationProvider,
        historyDate: historyDate || null,
        durationMs: Date.now() - startedAt,
      },
      selection: collection.selection,
      sources: collection.sources,
      results: directResults,
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

async function collectNewsSafely(options = {}) {
  try {
    const response = await executeAutoPublish(options);
    return {
      httpStatus: response.status,
      ...(await response.json()),
    };
  } catch (error) {
    return {
      success: false,
      message: error?.message || "News collection failed.",
    };
  }
}

async function collectCoverageSafely({ full = false, historyDate = "" } = {}) {
  try {
    const requestedSources = full
      ? [...COVERAGE_SOURCE_IDS]
      : selectScheduledCoverageSourceIds(COVERAGE_SOURCE_IDS);
    return await queueCoverageImport({ requestedSources, historyDate });
  } catch (error) {
    return {
      success: false,
      message: error?.message || "Coaching coverage collection failed.",
    };
  }
}

async function executeUnifiedCollection(
  scope = "scheduled",
  { full = false, newsBatch = 0, newsBatchSize = 6, historyDate = "" } = {}
) {
  const runNews = ["scheduled", "all", "news"].includes(scope);
  const runCoverage = ["scheduled", "all", "coverage"].includes(scope);
  const fullRun = full || scope === "all" || Boolean(historyDate);

  let news = { success: true, skipped: true };
  let coverage = { success: true, skipped: true };

  if (runNews && runCoverage) {
    [news, coverage] = await Promise.all([
      collectNewsSafely({
        full: fullRun,
        newsBatch,
        newsBatchSize,
        historyDate,
      }),
      collectCoverageSafely({ full: fullRun, historyDate }),
    ]);
  } else if (runNews) {
    news = await collectNewsSafely({
        full: fullRun,
        newsBatch,
        newsBatchSize,
        historyDate,
      });
  } else {
    coverage = await collectCoverageSafely({ full: fullRun, historyDate });
  }

  const requestedResults = [
    ...(runNews ? [news] : []),
    ...(runCoverage ? [coverage] : []),
  ];

  return NextResponse.json({
    success: requestedResults.some((result) => result.success),
    scope,
    full: fullRun,
    historyDate: historyDate || null,
    message:
      scope === "news"
        ? "News collection completed."
        : scope === "coverage"
          ? "Trusted coaching Current Affairs collection completed."
          : scope === "scheduled"
            ? "Scheduled low-CPU News and Current Affairs collection completed."
            : "Full News and trusted coaching Current Affairs collection completed.",
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

  const searchParams = new URL(request.url).searchParams;
  const waitForCompletion = searchParams.get("wait") === "1";
  const scope = searchParams.get("scope")?.trim().toLowerCase() || "scheduled";
  const full = searchParams.get("full") === "1";
  const rawHistoryDate = searchParams.get("historyDate")?.trim() || "";
  const historyDate = normalizeHistoryDate(rawHistoryDate);
  if (rawHistoryDate && !historyDate) {
    return NextResponse.json(
      {
        success: false,
        message: "Invalid historyDate. Use a real YYYY-MM-DD date.",
      },
      { status: 400 }
    );
  }
  const newsBatch = Math.max(
    0,
    Number(searchParams.get("newsBatch")) || 0
  );
  const newsBatchSize = Math.min(
    8,
    Math.max(2, Number(searchParams.get("newsBatchSize")) || 6)
  );
  const runner =
    searchParams.get("runner")?.trim().toLowerCase() || "";

  // The user still has external cron-job.org heartbeats. GitHub Actions
  // owns expensive background processing now, so an old no-wait scheduled
  // heartbeat stays successful without duplicating source/AI work.
  if (!waitForCompletion && scope === "scheduled" && runner !== "github") {
    return NextResponse.json({
      success: true, accepted: true, skipped: true, scope,
      message: "External automation heartbeat accepted; GitHub Actions owns scheduled processing.",
    }, { status: 202 });
  }

  if (!new Set(["scheduled", "all", "news", "coverage"]).has(scope)) {
    return NextResponse.json(
      {
        success: false,
        message: "Invalid collection scope. Use scheduled, all, news, or coverage.",
      },
      { status: 400 }
    );
  }

  if (waitForCompletion) {
    return executeUnifiedCollection(scope, {
      full,
      newsBatch,
      newsBatchSize,
      historyDate,
    });
  }

  after(async () => {
    const runId = await startAutomationRun("auto_publish");

    try {
      const response = await executeUnifiedCollection(scope, {
        full,
        newsBatch,
        newsBatchSize,
        historyDate,
      });
      const payload = await response.json();
      const coverage = payload.coverage || {};
      const news = payload.news || {};

      await finishAutomationRun(runId, {
        success: Boolean(payload.success),
        summary: {
          scope,
          full: Boolean(payload.full),
          news: {
            success: Boolean(news.success),
            skipped: Boolean(news.skipped),
            selectedSources: news.selection?.selectedIds || [],
            collected: news.stats?.collected || 0,
            published: news.stats?.published || 0,
            duplicates: news.stats?.duplicates || 0,
            rejected: news.stats?.rejectedAfterValidation || 0,
            failed: news.stats?.failed || 0,
          },
          coverage: {
            success: Boolean(coverage.success),
            skipped: Boolean(coverage.skipped),
            selectedSources: coverage.requestedSources || [],
            sourceErrors: coverage.sourceErrors || {},
            fetched: coverage.fetched || 0,
            hybridEvents: coverage.hybridEvents || 0,
            immediateProcessed: coverage.immediateProcessed || 0,
            immediatePublished: coverage.immediatePublished || 0,
            immediateEnriched: coverage.immediateEnriched || 0,
            deferredToQueue: coverage.deferredToQueue || 0,
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
        `[Auto publish] ${scope} background collection completed with HTTP ${response.status}.`
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
      scope,
      full: full || scope === "all" || Boolean(historyDate),
      historyDate: historyDate || null,
      message:
        scope === "scheduled"
          ? "Scheduled low-CPU News and Current Affairs collection was accepted for background processing."
          : scope === "news"
            ? "Automatic news collection was accepted for background processing."
            : scope === "coverage"
              ? "Trusted coaching Current Affairs collection was accepted for background processing."
              : "Full News and trusted coaching Current Affairs collection was accepted for background processing.",
    },
    { status: 202 }
  );
}
