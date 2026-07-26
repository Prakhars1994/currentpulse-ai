import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request) {
  const startedAt = Date.now();

  try {
    let body = {};

    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const requestedLimit = Number(body?.limit);

    const limit =
      Number.isFinite(requestedLimit) && requestedLimit > 0
        ? Math.min(Math.floor(requestedLimit), 20)
        : 3;

    /*
      The complete pipeline will send the IDs of articles
      generated during that specific run.

      Example:
      {
        "articleIds": [26, 27, 28]
      }
    */
    let articleIds = Array.isArray(body?.articleIds)
      ? body.articleIds
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id))
      : [];

    articleIds = [...new Set(articleIds)];

    /*
      Fallback for the separate "Publish Drafts" button:

      If no article IDs were supplied, select only articles
      connected to generated news_queue records.

      This prevents unrelated old manual drafts from being
      published automatically.
    */
    if (articleIds.length === 0) {
      const { data: queueItems, error: queueItemsError } =
        await supabaseAdmin
          .from("news_queue")
          .select("article_id, generated_at")
          .not("article_id", "is", null)
          .in("status", ["GENERATED", "DRAFT"])
          .order("generated_at", { ascending: false })
          .limit(limit);

      if (queueItemsError) {
        throw queueItemsError;
      }

      articleIds = [
        ...new Set(
          (queueItems || [])
            .map((item) => Number(item.article_id))
            .filter((id) => Number.isFinite(id))
        ),
      ];
    }

    if (articleIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No generated draft articles are available.",
        stats: {
          requested: 0,
          selected: 0,
          published: 0,
          failed: 0,
          durationMs: Date.now() - startedAt,
        },
        results: [],
      });
    }

    const { data: drafts, error: draftsError } =
      await supabaseAdmin
        .from("articles")
        .select("id, title, slug, status, created_at")
        .in("id", articleIds)
        .eq("status", "draft");

    if (draftsError) {
      throw draftsError;
    }

    if (!drafts || drafts.length === 0) {
      return NextResponse.json({
        success: true,
        message:
          "The selected generated articles are already published or unavailable.",
        stats: {
          requested: articleIds.length,
          selected: 0,
          published: 0,
          failed: 0,
          durationMs: Date.now() - startedAt,
        },
        results: [],
      });
    }

    const results = [];

    for (const draft of drafts) {
      try {
        const publishedAt = new Date().toISOString();

        const { data: article, error: articleError } =
          await supabaseAdmin
            .from("articles")
            .update({
              status: "published",
              published_at: publishedAt,
            })
            .eq("id", draft.id)
            .eq("status", "draft")
            .select(
              "id, title, slug, status, published_at"
            )
            .single();

        if (articleError) {
          throw articleError;
        }

        const { error: queueError } =
          await supabaseAdmin
            .from("news_queue")
            .update({
              status: "PUBLISHED",
            })
            .eq("article_id", draft.id);

        if (queueError) {
          throw queueError;
        }

        results.push({
          articleId: article.id,
          title: article.title,
          slug: article.slug,
          success: true,
          error: null,
        });
      } catch (error) {
        results.push({
          articleId: draft.id,
          title: draft.title,
          slug: draft.slug,
          success: false,
          error:
            error?.message ||
            "Failed to publish article.",
        });
      }
    }

    const published = results.filter(
      (item) => item.success
    ).length;

    const failed = results.length - published;

    return NextResponse.json({
      success: failed === 0,
      message: `Published ${published} generated article(s).`,
      stats: {
        requested: articleIds.length,
        selected: drafts.length,
        published,
        failed,
        durationMs: Date.now() - startedAt,
      },
      results,
    });
  } catch (error) {
    console.error(
      "PUBLISH GENERATED DRAFTS API ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          "Failed to publish generated draft articles.",
        stats: {
          durationMs: Date.now() - startedAt,
        },
      },
      { status: 500 }
    );
  }
}