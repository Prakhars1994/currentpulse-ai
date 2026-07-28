import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { evaluateNews } from "@/lib/ai/evaluateNews";

import { GET as fetchAllNewsGet } from "@/app/api/fetch-all-news/route";
import { POST as generateArticlePost } from "@/app/api/generate-article/route";
import { POST as publishDraftsPost } from "@/app/api/publish-drafts/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/*
|--------------------------------------------------------------------------
| Utility functions
|--------------------------------------------------------------------------
*/

function getSafeLimit(value, defaultValue, maximumValue) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return defaultValue;
  }

  return Math.min(
    Math.floor(parsedValue),
    maximumValue
  );
}

async function readJsonResponse(response, stepName) {
  const responseText = await response.text();

  let result;

  try {
    result = JSON.parse(responseText);
  } catch {
    throw new Error(
      `${stepName} returned non-JSON content: ${responseText.slice(
        0,
        500
      )}`
    );
  }

  if (!response.ok || result.success !== true) {
    throw new Error(
      result.error ||
        result.message ||
        `${stepName} failed with status ${response.status}.`
    );
  }

  return result;
}

/*
|--------------------------------------------------------------------------
| Step 1: Fetch news
|--------------------------------------------------------------------------
*/

async function fetchNews({
  perSource = 8,
  aiLimit = 0,
} = {}) {
  const url = new URL(
    "http://localhost/api/fetch-all-news"
  );

  url.searchParams.set(
    "perSource",
    String(perSource)
  );

  /*
   * Evaluation is disabled here because the dedicated queue
   * evaluation stage runs immediately afterwards.
   */

  url.searchParams.set("evaluate", "false");
  url.searchParams.set(
    "aiLimit",
    String(aiLimit)
  );
  url.searchParams.set("save", "true");

  const internalRequest = new Request(
    url.toString(),
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  console.log(
    "AUTOMATION: Starting news collection."
  );

  const response =
    await fetchAllNewsGet(internalRequest);

  return readJsonResponse(
    response,
    "News collection"
  );
}

/*
|--------------------------------------------------------------------------
| Step 2: Evaluate news queue
|--------------------------------------------------------------------------
*/

async function evaluateQueueItems(limit) {
  const { data: queueItems, error: queueError } =
    await supabaseAdmin
      .from("news_queue")
      .select(
        "id, title, summary, source, status"
      )
      .eq("status", "NEW")
      .is("evaluated_at", null)
      .order("created_at", {
        ascending: true,
      })
      .limit(limit);

  if (queueError) {
    throw queueError;
  }

  const results = [];

  for (const queueItem of queueItems || []) {
    try {
      const evaluation = await evaluateNews(
        queueItem.title,
        queueItem.summary || ""
      );

      const newStatus =
        evaluation.relevant === true
          ? "NEW"
          : "REJECTED";

      const { error: updateError } =
        await supabaseAdmin
          .from("news_queue")
          .update({
            relevant:
              evaluation.relevant === true,

            score: Number(
              evaluation.importance || 0
            ),

            category:
              evaluation.category || null,

            paper:
              evaluation.paper || null,

            reason:
              evaluation.reason || null,

            keywords:
              evaluation.keywords || [],

            evaluated_at:
              new Date().toISOString(),

            status: newStatus,
          })
          .eq("id", queueItem.id);

      if (updateError) {
        throw updateError;
      }

      results.push({
        queueId: queueItem.id,
        title: queueItem.title,
        success: true,
        relevant:
          evaluation.relevant === true,
        score: Number(
          evaluation.importance || 0
        ),
        category:
          evaluation.category || null,
        paper: evaluation.paper || null,
        status: newStatus,
        error: null,
      });
    } catch (error) {
      console.error(
        "AUTOMATION EVALUATION ERROR:",
        queueItem.id,
        error
      );

      results.push({
        queueId: queueItem.id,
        title: queueItem.title,
        success: false,
        relevant: null,
        score: null,
        category: null,
        paper: null,
        status: queueItem.status,
        error:
          error?.message ||
          "AI relevance evaluation failed.",
      });
    }
  }

  const evaluated = results.filter(
    (item) => item.success
  ).length;

  const relevant = results.filter(
    (item) =>
      item.success &&
      item.relevant === true
  ).length;

  const rejected = results.filter(
    (item) =>
      item.success &&
      item.relevant === false
  ).length;

  const failed = results.filter(
    (item) => !item.success
  ).length;

  return {
    selected: queueItems?.length || 0,
    evaluated,
    relevant,
    rejected,
    failed,
    results,
  };
}

/*
|--------------------------------------------------------------------------
| Step 3: Generate draft articles
|--------------------------------------------------------------------------
*/

async function generateDrafts(limit) {
  const { data: queueItems, error: queueError } =
    await supabaseAdmin
      .from("news_queue")
      .select(
        "id, title, source, score, status"
      )
      .eq("status", "NEW")
      .eq("relevant", true)
      .is("article_id", null)
      .order("score", {
        ascending: false,
      })
      .order("created_at", {
        ascending: true,
      })
      .limit(limit);

  if (queueError) {
    throw queueError;
  }

  const results = [];

  for (const queueItem of queueItems || []) {
    try {
      const internalRequest = new Request(
        "http://localhost/api/generate-article",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            queueId: queueItem.id,
          }),
        }
      );

      console.log(
        "AUTOMATION: Generating article:",
        queueItem.id,
        queueItem.title
      );

      const response =
        await generateArticlePost(
          internalRequest
        );

      const result = await readJsonResponse(
        response,
        "Article generation"
      );

      results.push({
        queueId: queueItem.id,
        title: queueItem.title,
        success: true,
        articleId:
          result.article?.id ||
          result.articleId ||
          null,
        error: null,
      });
    } catch (error) {
      console.error(
        "AUTOMATION GENERATION ERROR:",
        queueItem.id,
        error
      );

      results.push({
        queueId: queueItem.id,
        title: queueItem.title,
        success: false,
        articleId: null,
        error:
          error?.message ||
          "Article generation failed.",
      });
    }
  }

  const generated = results.filter(
    (item) => item.success
  ).length;

  return {
    selected: queueItems?.length || 0,
    generated,
    failed:
      results.length - generated,
    results,
  };
}

/*
|--------------------------------------------------------------------------
| Step 4: Publish generated drafts
|--------------------------------------------------------------------------
*/

async function publishDrafts(limit) {
  const internalRequest = new Request(
    "http://localhost/api/publish-drafts",
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        limit,
      }),
    }
  );

  console.log(
    "AUTOMATION: Publishing generated drafts."
  );

  const response =
    await publishDraftsPost(
      internalRequest
    );

  return readJsonResponse(
    response,
    "Draft publishing"
  );
}

/*
|--------------------------------------------------------------------------
| Run complete automation pipeline
|--------------------------------------------------------------------------
*/

async function runFullAutomation(options = {}) {
  const startedAt = Date.now();

  const perSource = getSafeLimit(
    options.perSource,
    8,
    20
  );

  const evaluationLimit = getSafeLimit(
    options.evaluationLimit ||
      options.evaluateLimit,
    20,
    30
  );

  const generationLimit = getSafeLimit(
    options.generationLimit ||
      options.generateLimit,
    3,
    10
  );

  const publishLimit = getSafeLimit(
    options.publishLimit,
    generationLimit,
    10
  );

  const steps = {
    fetch: null,
    evaluate: null,
    generate: null,
    publish: null,
  };

  /*
   * Fetching must succeed before the pipeline continues.
   */

  steps.fetch = await fetchNews({
    perSource,
    aiLimit: 0,
  });

  /*
   * Evaluation errors for individual stories do not stop
   * successful stories from proceeding.
   */

  steps.evaluate =
    await evaluateQueueItems(
      evaluationLimit
    );

  /*
   * Generate only evaluated, relevant queue items.
   */

  steps.generate =
    await generateDrafts(
      generationLimit
    );

  /*
   * Publish only when at least one draft was generated.
   */

  if (steps.generate.generated > 0) {
    steps.publish =
      await publishDrafts(
        publishLimit
      );
  } else {
    steps.publish = {
      success: true,
      message:
        "No newly generated drafts were available to publish.",
      stats: {
        requested: publishLimit,
        selected: 0,
        published: 0,
        failed: 0,
      },
      results: [],
    };
  }

  const evaluationFailures =
    steps.evaluate.failed || 0;

  const generationFailures =
    steps.generate.failed || 0;

  const publishingFailures =
    steps.publish?.stats?.failed || 0;

  const totalFailures =
    evaluationFailures +
    generationFailures +
    publishingFailures;

  return {
    success: totalFailures === 0,

    message:
      totalFailures === 0
        ? "Full automation pipeline completed successfully."
        : `Automation completed with ${totalFailures} failure(s).`,

    stats: {
      fetched:
        steps.fetch?.stats?.collected || 0,

      deduplicated:
        steps.fetch?.stats
          ?.deduplicated || 0,

      queueSaved:
        steps.fetch?.stats
          ?.queueSaved || 0,

      evaluated:
        steps.evaluate.evaluated,

      relevant:
        steps.evaluate.relevant,

      rejected:
        steps.evaluate.rejected,

      generated:
        steps.generate.generated,

      published:
        steps.publish?.stats
          ?.published || 0,

      failed: totalFailures,

      durationMs:
        Date.now() - startedAt,
    },

    steps,
  };
}

/*
|--------------------------------------------------------------------------
| Request handler
|--------------------------------------------------------------------------
*/

async function handleAutomationRequest(body = {}) {
  const startedAt = Date.now();

  const action =
    body?.action || "full";

  if (action === "full") {
    return runFullAutomation(body);
  }

  if (action === "fetch") {
    const perSource = getSafeLimit(
      body?.perSource,
      8,
      20
    );

    const result = await fetchNews({
      perSource,
      aiLimit: 0,
    });

    return {
      success: true,
      message:
        "News collection completed.",
      stats: {
        ...result.stats,
        durationMs:
          Date.now() - startedAt,
      },
      results:
        result.articles || [],
    };
  }

  if (action === "evaluate") {
    const limit = getSafeLimit(
      body?.limit,
      20,
      30
    );

    const evaluation =
      await evaluateQueueItems(limit);

    return {
      success:
        evaluation.failed === 0,

      message:
        evaluation.selected === 0
          ? "No unevaluated NEW items are available."
          : `Evaluated ${evaluation.evaluated} news item(s).`,

      stats: {
        selected:
          evaluation.selected,

        evaluated:
          evaluation.evaluated,

        relevant:
          evaluation.relevant,

        rejected:
          evaluation.rejected,

        failed:
          evaluation.failed,

        durationMs:
          Date.now() - startedAt,
      },

      results:
        evaluation.results,
    };
  }

  if (action === "generate") {
    const limit = getSafeLimit(
      body?.limit,
      5,
      10
    );

    const generation =
      await generateDrafts(limit);

    return {
      success:
        generation.failed === 0,

      message:
        generation.selected === 0
          ? "No evaluated and relevant NEW items are available."
          : `Generated ${generation.generated} draft article(s).`,

      stats: {
        selected:
          generation.selected,

        generated:
          generation.generated,

        failed:
          generation.failed,

        durationMs:
          Date.now() - startedAt,
      },

      results:
        generation.results,
    };
  }

  if (action === "publish") {
    const limit = getSafeLimit(
      body?.limit,
      3,
      10
    );

    const publication =
      await publishDrafts(limit);

    return {
      ...publication,

      stats: {
        ...(publication.stats || {}),

        durationMs:
          Date.now() - startedAt,
      },
    };
  }

  throw new Error(
    `Invalid automation action: ${action}`
  );
}

/*
|--------------------------------------------------------------------------
| POST: Admin and manual automation requests
|--------------------------------------------------------------------------
*/

export async function POST(request) {
  try {
    let body = {};

    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const result =
      await handleAutomationRequest(body);

    return NextResponse.json(
      result,
      {
        status:
          result.success === false
            ? 207
            : 200,
      }
    );
  } catch (error) {
    console.error(
      "AUTOMATION POST ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          "The automation process failed.",
      },
      {
        status: 500,
      }
    );
  }
}

/*
|--------------------------------------------------------------------------
| GET: Vercel Cron
|--------------------------------------------------------------------------
*/

export async function GET(request) {
  try {
    const { searchParams } = new URL(
      request.url
    );

    const result =
      await handleAutomationRequest({
        action:
          searchParams.get("action") ||
          "full",

        perSource:
          searchParams.get("perSource"),

        evaluationLimit:
          searchParams.get(
            "evaluationLimit"
          ),

        generationLimit:
          searchParams.get(
            "generationLimit"
          ),

        publishLimit:
          searchParams.get(
            "publishLimit"
          ),
      });

    return NextResponse.json(
      result,
      {
        status:
          result.success === false
            ? 207
            : 200,
      }
    );
  } catch (error) {
    console.error(
      "AUTOMATION GET ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          "The scheduled automation process failed.",
      },
      {
        status: 500,
      }
    );
  }
}