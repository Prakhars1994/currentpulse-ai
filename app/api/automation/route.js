import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { evaluateNews } from "@/lib/ai/evaluateNews";
import { POST as generateArticlePost } from "@/app/api/generate-article/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function evaluateQueueItems(limit) {
  const { data: queueItems, error: queueError } =
    await supabaseAdmin
      .from("news_queue")
      .select("id, title, summary, source, status")
      .eq("status", "NEW")
      .is("evaluated_at", null)
      .order("created_at", { ascending: true })
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

      const newStatus = evaluation.relevant
        ? "NEW"
        : "REJECTED";

      const { error: updateError } = await supabaseAdmin
        .from("news_queue")
        .update({
          relevant: evaluation.relevant,
          score: evaluation.importance,
          category: evaluation.category,
          paper: evaluation.paper,
          reason: evaluation.reason,
          keywords: evaluation.keywords,
          evaluated_at: new Date().toISOString(),
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
        relevant: evaluation.relevant,
        score: evaluation.importance,
        category: evaluation.category,
        paper: evaluation.paper,
        status: newStatus,
        error: null,
      });
    } catch (error) {
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
    (item) => item.success && item.relevant
  ).length;

  const rejected = results.filter(
    (item) => item.success && !item.relevant
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

async function generateDrafts(limit) {
  const { data: queueItems, error: queueError } =
    await supabaseAdmin
      .from("news_queue")
      .select("id, title, source, score, status")
      .eq("status", "NEW")
      .eq("relevant", true)
      .is("article_id", null)
      .order("score", { ascending: false })
      .order("created_at", { ascending: true })
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
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            queueId: queueItem.id,
          }),
        }
      );

      console.log(
        "AUTOMATION: Calling generateArticlePost for:",
        queueItem.id,
        queueItem.title
      );

      const response =
        await generateArticlePost(internalRequest);

      console.log(
        "AUTOMATION: generateArticlePost returned with status:",
        response.status
      );

      const responseText = await response.text();

      console.log(
        "AUTOMATION: Raw generation response:",
        responseText.slice(0, 1000)
      );

      let result;

      try {
        result = JSON.parse(responseText);
      } catch {
        throw new Error(
          `Generate article returned non-JSON content: ${responseText.slice(
            0,
            300
          )}`
        );
      }

      results.push({
        queueId: queueItem.id,
        title: queueItem.title,
        success:
          response.ok && result.success === true,
        articleId:
          result.article?.id ||
          result.articleId ||
          null,
        error: result.error || null,
      });
    } catch (error) {
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

  const failed = results.length - generated;

  return {
    selected: queueItems?.length || 0,
    generated,
    failed,
    results,
  };
}
export async function POST(request) {
  const startedAt = Date.now();

  try {
    let body = {};

    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const action = body?.action || "generate";
const requestedLimit = Number(body?.limit);

const defaultLimit =
  action === "evaluate" ? 20 : 5;

const maximumLimit =
  action === "evaluate" ? 30 : 10;

const limit =
  Number.isFinite(requestedLimit) &&
  requestedLimit > 0
    ? Math.min(
        Math.floor(requestedLimit),
        maximumLimit
      )
    : defaultLimit;

    if (action === "evaluate") {
      const evaluation =
        await evaluateQueueItems(limit);

      return NextResponse.json({
        success: evaluation.failed === 0,
        message:
          evaluation.selected === 0
            ? "No unevaluated NEW items are available."
            : `Evaluated ${evaluation.evaluated} news item(s).`,
        stats: {
          selected: evaluation.selected,
          evaluated: evaluation.evaluated,
          relevant: evaluation.relevant,
          rejected: evaluation.rejected,
          failed: evaluation.failed,
          durationMs:
            Date.now() - startedAt,
        },
        results: evaluation.results,
      });
    }

    if (action === "generate") {
      const generation =
        await generateDrafts(limit);

      return NextResponse.json({
        success: generation.failed === 0,
        message:
          generation.selected === 0
            ? "No evaluated and relevant NEW items are available."
            : `Generated ${generation.generated} draft article(s).`,
        stats: {
          selected: generation.selected,
          generated: generation.generated,
          failed: generation.failed,
          durationMs:
            Date.now() - startedAt,
        },
        results: generation.results,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: "Invalid automation action.",
      },
      { status: 400 }
    );
  } catch (error) {
    console.error(
      "AUTOMATION API ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          "The automation process failed.",
        stats: {
          durationMs:
            Date.now() - startedAt,
        },
      },
      { status: 500 }
    );
  }
}