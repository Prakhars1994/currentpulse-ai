import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { NEWS_SOURCES, UPSC_QUERY_TERMS } from "@/lib/news/sourceCatalog";
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

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

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
    Array.from(
      {
        length: Math.min(concurrency, items.length),
      },
      () => runner()
    )
  );

  return results;
}

async function evaluateArticles(articles, aiLimit) {
  const candidates = articles.slice(0, aiLimit);

  const settled = await runWithConcurrency(
    candidates,
    AI_CONCURRENCY,
    (article) =>
      evaluateNews(
        article.title,
        article.description || article.title
      )
  );

  return candidates.map((article, index) => {
    const result = settled[index];

    if (result?.status === "fulfilled") {
      return {
        ...article,
        evaluation: result.value,
        evaluationError: null,
      };
    }

    return {
      ...article,
      evaluation: null,
      evaluationError:
        result?.reason?.message || "AI evaluation failed",
    };
  });
}

/*
|--------------------------------------------------------------------------
| Get the article URL
|--------------------------------------------------------------------------
*/

function getArticleUrl(article) {
  return (
    article.url ||
    article.link ||
    article.guid ||
    null
  );
}

/*
|--------------------------------------------------------------------------
| Get the source name
|--------------------------------------------------------------------------
*/

function getSourceName(article) {
  if (typeof article.source === "string") {
    return article.source;
  }

  if (article.source?.name) {
    return article.source.name;
  }

  if (article.sourceName) {
    return article.sourceName;
  }

  return "Unknown Source";
}

/*
|--------------------------------------------------------------------------
| Convert fetched articles into news_queue rows
|--------------------------------------------------------------------------
*/

function createQueueRows(articles) {
  return articles
    .map((article) => {
      const url = getArticleUrl(article);

      if (!article.title || !url) {
        return null;
      }

      const evaluationScore = Number(
        article.evaluation?.importance
      );

      const preliminaryScore = Number(
        article.preliminaryScore ??
          article.score ??
          article.importance
      );

      const score = Number.isFinite(evaluationScore)
        ? evaluationScore
        : Number.isFinite(preliminaryScore)
          ? preliminaryScore
          : 0;

      return {
        title: article.title.trim(),
        source: getSourceName(article),
        url,
        summary:
          article.description ||
          article.summary ||
          article.snippet ||
          "",
        score,
        status: "NEW",
      };
    })
    .filter(Boolean);
}

/*
|--------------------------------------------------------------------------
| Save articles to Supabase
|--------------------------------------------------------------------------
*/

async function saveArticlesToNewsQueue(articles) {
  const rows = createQueueRows(articles);

  if (rows.length === 0) {
    return {
      attempted: 0,
      saved: 0,
      skipped: articles.length,
      error: null,
    };
  }

  /*
   * The URL column is unique.
   *
   * ignoreDuplicates prevents an existing article from causing
   * the complete insert operation to fail.
   */

const { data, error } = await supabaseAdmin
  .from("news_queue")
  .upsert(rows, {
    onConflict: "url",
    ignoreDuplicates: true,
  })
  
    .select("id, url");

  if (error) {
    console.error("NEWS QUEUE INSERT ERROR:", error);

    return {
      attempted: rows.length,
      saved: 0,
      skipped: articles.length - rows.length,
      error: error.message,
    };
  }

  return {
    attempted: rows.length,
    saved: data?.length || 0,
    skipped: articles.length - rows.length,
    error: null,
  };
}

export async function GET(request) {
  const startedAt = Date.now();

  try {
    const { searchParams } = new URL(request.url);

    const perSource = clamp(
      searchParams.get("perSource"),
      2,
      20,
      DEFAULT_PER_SOURCE
    );

    const aiLimit = clamp(
      searchParams.get("aiLimit"),
      0,
      40,
      DEFAULT_AI_LIMIT
    );

    const shouldEvaluate =
      searchParams.get("evaluate") !== "false" &&
      aiLimit > 0;

    /*
     * You can temporarily disable database saving by using:
     *
     * /api/fetch-all-news?save=false
     */

    const shouldSave =
      searchParams.get("save") !== "false";

    const requestedGroups = searchParams
      .get("groups")
      ?.split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    const sources = requestedGroups?.length
      ? NEWS_SOURCES.filter((source) =>
          requestedGroups.includes(source.group)
        )
      : NEWS_SOURCES;

    /*
    |--------------------------------------------------------------------------
    | Fetch all sources
    |--------------------------------------------------------------------------
    */

    const sourceResults = await Promise.all(
      sources.map(async (source) => {
        try {
          const result = await fetchSourceRss(
            source,
            UPSC_QUERY_TERMS
          );

          return {
            source,
            articles: result.articles
              .slice(0, perSource)
              .map((article) => ({
                ...article,

                /*
                 * This guarantees that every article has its
                 * configured source name.
                 */

                source:
                  article.source ||
                  source.name,
              })),
            errors: result.errors,
            failed: false,
          };
        } catch (error) {
          return {
            source,
            articles: [],
            errors: [
              error?.message || "Source failed",
            ],
            failed: true,
          };
        }
      })
    );

    /*
    |--------------------------------------------------------------------------
    | Combine and remove duplicates
    |--------------------------------------------------------------------------
    */

    const collected = sourceResults.flatMap(
      (result) => result.articles
    );

    const deduplicated =
      deduplicateArticles(collected);

    /*
    |--------------------------------------------------------------------------
    | AI evaluation
    |--------------------------------------------------------------------------
    */

    const evaluated = shouldEvaluate
      ? await evaluateArticles(
          deduplicated,
          aiLimit
        )
      : deduplicated;

    /*
    |--------------------------------------------------------------------------
    | Keep relevant stories
    |--------------------------------------------------------------------------
    */

    const relevant = shouldEvaluate
      ? evaluated
          .filter(
            (article) =>
              article.evaluation?.relevant === true &&
              Number(
                article.evaluation.importance
              ) >= MINIMUM_IMPORTANCE
          )
          .sort(
            (articleA, articleB) =>
              Number(
                articleB.evaluation?.importance || 0
              ) -
              Number(
                articleA.evaluation?.importance || 0
              )
          )
      : evaluated;

    /*
    |--------------------------------------------------------------------------
    | Save to news_queue
    |--------------------------------------------------------------------------
    */

    let queueResult = {
      attempted: 0,
      saved: 0,
      skipped: 0,
      error: null,
    };

    if (shouldSave) {
      queueResult =
        await saveArticlesToNewsQueue(relevant);
    }

    return NextResponse.json({
      success: true,

      mode: shouldEvaluate
        ? "collected-filtered-ranked-saved"
        : "collection-only-saved",

      note:
        "Commercial publishers are collected through headline, snippet and link feeds. Full copyrighted articles are not republished. PIB remains available through /api/fetch-todays-news.",

      stats: {
        configuredSources:
          NEWS_SOURCES.length + 1,

        attemptedFeedSources:
          sources.length,

        successfulSources:
          sourceResults.filter(
            (result) =>
              result.articles.length > 0
          ).length,

        failedSources:
          sourceResults.filter(
            (result) => result.failed
          ).length,

        collected: collected.length,

        deduplicated:
          deduplicated.length,

        evaluated: shouldEvaluate
          ? evaluated.length
          : 0,

        relevant: relevant.length,

        queueAttempted:
          queueResult.attempted,

        queueSaved:
          queueResult.saved,

        queueSkipped:
          queueResult.skipped,

        queueError:
          queueResult.error,

        durationMs:
          Date.now() - startedAt,
      },

      sourceStatus: sourceResults.map(
        (result) => ({
          id: result.source.id,
          name: result.source.name,
          group: result.source.group,
          fetched: result.articles.length,
          errors: result.errors,
        })
      ),

      articles: relevant,
    });
  } catch (error) {
    console.error(
      "FETCH ALL NEWS ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          "Failed to fetch and save news",
        stats: {
          durationMs:
            Date.now() - startedAt,
        },
      },
      {
        status: 500,
      }
    );
  }
}