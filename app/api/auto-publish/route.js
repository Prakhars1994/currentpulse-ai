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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 150;

const QUEUE_WRITE_CONCURRENCY = 3;
const QUEUE_DUPLICATE_LOOKBACK_DAYS = 10;
const QUEUE_DUPLICATE_LIMIT = 450;
const NEWS_MAX_QUEUE_WRITES_PER_RUN = Math.max(
  1,
  Number(process.env.NEWS_MAX_QUEUE_WRITES_PER_RUN || 24)
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

async function collectNews({ full = false } = {}) {
  const configuredSources = activeNewsSources();
  const scheduled = selectScheduledNewsSources(NEWS_SOURCES);
  const selectedSources = full ? configuredSources : scheduled.sources;
  const sourceResults = await Promise.all(
    selectedSources.map(async (source) => {
      try {
        const result = await fetchSourceRss(source, GENERAL_NEWS_QUERY_TERMS);
        const articleLikeItems = result.articles.filter(
          (article) => assessNewsCandidate(article).allowed
        );
        const uniqueForSource = deduplicateArticles(articleLikeItems);

        return {
          id: source.id,
          name: source.name,
          group: source.group,
          fetched: result.articles.length,
          selected: uniqueForSource.length,
          nonArticlesRejected: result.articles.length - articleLikeItems.length,
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
      mode: full ? "full" : "scheduled",
      configuredCount: configuredSources.length,
      selectedCount: selectedSources.length,
      selectedIds: selectedSources.map((source) => source.id),
      coreCount: full ? null : scheduled.coreCount,
      supplementalCount: full ? null : scheduled.supplementalCount,
    },
    sources: sourceResults.map((result) => ({
      id: result.id,
      name: result.name,
      fetched: result.fetched,
      selected: result.selected,
      nonArticlesRejected: result.nonArticlesRejected,
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
    reason: `Collected from the fresh feed of ${independentCoverage} publisher${independentCoverage === 1 ? "" : "s"}; no importance selection applied.`,
    keywords: [],
  };
}

async function evaluateCandidates(supabase, articles) {
  const recentArticles = await loadRecentArticles(supabase, {
    lookbackDays: 14,
    limit: 450,
  });

  const eligible = [];
  const skipped = [];

  for (const article of articles) {
    const safety = assessNewsCandidate(article);
    if (!safety.allowed) {
      skipped.push({ title: article.title, reason: safety.code });
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

async function loadRecentQueueState(supabase) {
  const cutoff = new Date(
    Date.now() - QUEUE_DUPLICATE_LOOKBACK_DAYS * 86_400_000
  ).toISOString();
  const { data, error } = await supabase
    .from("article_queue")
    .select("id,url,title,description,published_at,status")
    .in("status", ["pending", "processing", "published", "duplicate"])
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(QUEUE_DUPLICATE_LIMIT);

  if (error) throw new Error(`Recent queue duplicate check failed: ${error.message}`);
  return data || [];
}

function filterQueueDuplicates(candidates, recentQueueRows) {
  const queueRows = [...recentQueueRows];
  const urls = new Set(
    queueRows.map((row) => cleanText(row.url)).filter(Boolean)
  );
  const accepted = [];
  const skipped = [];

  for (const candidate of candidates) {
    const article = candidate.article;
    const sourceUrl = cleanText(article.url || article.link || article.sourceUrl);
    if (sourceUrl && urls.has(sourceUrl)) {
      skipped.push({ title: article.title, reason: "already_in_queue_url" });
      continue;
    }

    const existing = queueRows.find((row) =>
      isSameEvent(
        {
          title: article.title,
          description: article.description,
          publishedAt: article.publishedAt,
        },
        {
          title: row.title,
          description: row.description,
          publishedAt: row.published_at,
        }
      )
    );
    if (existing) {
      skipped.push({
        title: article.title,
        reason: `already_in_queue_${existing.status}`,
        queueId: existing.id,
      });
      continue;
    }

    accepted.push(candidate);
    if (sourceUrl) urls.add(sourceUrl);
    queueRows.push({
      id: null,
      url: sourceUrl,
      title: article.title,
      description: article.description,
      published_at: article.publishedAt,
      status: "pending",
    });
  }

  return { accepted, skipped };
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
          skipEventLookup: status === "pending",
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

async function executeAutoPublish({ full = false } = {}) {
  const startedAt = Date.now();

  try {
    const supabase = createServerSupabase();
    const collection = await collectNews({ full });
    const evaluated = await evaluateCandidates(supabase, collection.articles);
    const recentQueueRows = evaluated.accepted.length
      ? await loadRecentQueueState(supabase)
      : [];
    const queueFiltered = filterQueueDuplicates(evaluated.accepted, recentQueueRows);
    const queueBatch = queueFiltered.accepted.slice(0, NEWS_MAX_QUEUE_WRITES_PER_RUN);
    const deferredForNextRun = Math.max(
      0,
      queueFiltered.accepted.length - queueBatch.length
    );

    const [acceptedResults, rejectedResults] = await Promise.all([
      writeCandidates(supabase, queueBatch, "pending"),
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
          ? `${queued} fresh unique newspaper articles added to the publishing queue.`
          : "No new newspaper articles were queued.",
      stats: {
        collected: collection.articles.length,
        evaluated: evaluated.accepted.length + evaluated.rejected.length,
        relevantCandidates: evaluated.accepted.length,
        rejectedCandidates: evaluated.rejected.length,
        rejectedPreserved,
        duplicatesOrInvalidSkipped: evaluated.skipped.length,
        queueDuplicatesSkipped: queueFiltered.skipped.length,
        queueWriteLimit: NEWS_MAX_QUEUE_WRITES_PER_RUN,
        deferredForNextRun,
        queued,
        failed,
        evaluationProvider: evaluated.evaluationProvider,
        durationMs: Date.now() - startedAt,
      },
      selection: collection.selection,
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

async function collectCoverageSafely({ full = false } = {}) {
  try {
    const requestedSources = full
      ? [...COVERAGE_SOURCE_IDS]
      : selectScheduledCoverageSourceIds(COVERAGE_SOURCE_IDS);
    return await queueCoverageImport({ requestedSources });
  } catch (error) {
    return {
      success: false,
      message: error?.message || "Coaching coverage collection failed.",
    };
  }
}

async function executeUnifiedCollection(scope = "scheduled", { full = false } = {}) {
  const runNews = ["scheduled", "all", "news"].includes(scope);
  const runCoverage = ["scheduled", "all", "coverage"].includes(scope);
  const fullRun = full || scope === "all";

  let news = { success: true, skipped: true };
  let coverage = { success: true, skipped: true };

  if (runNews && runCoverage) {
    [news, coverage] = await Promise.all([
      collectNewsSafely({ full: fullRun }),
      collectCoverageSafely({ full: fullRun }),
    ]);
  } else if (runNews) {
    news = await collectNewsSafely({ full: fullRun });
  } else {
    coverage = await collectCoverageSafely({ full: fullRun });
  }

  const requestedResults = [
    ...(runNews ? [news] : []),
    ...(runCoverage ? [coverage] : []),
  ];

  return NextResponse.json({
    success: requestedResults.some((result) => result.success),
    scope,
    full: fullRun,
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
  const runner = searchParams.get("runner")?.trim().toLowerCase() || "";

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

  if (waitForCompletion) return executeUnifiedCollection(scope, { full });

  after(async () => {
    const runId = await startAutomationRun("auto_publish");

    try {
      const response = await executeUnifiedCollection(scope, { full });
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
            queued: news.stats?.queued || 0,
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
      full: full || scope === "all",
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
