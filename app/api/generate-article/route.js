import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { generateArticle } from "@/lib/ai/generateArticle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function createSlug(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function POST(request) {
  let queueId = null;

  try {
    const body = await request.json();
    queueId = body?.queueId;

    if (!queueId) {
      return NextResponse.json(
        {
          success: false,
          error: "queueId is required.",
        },
        { status: 400 }
      );
    }

    const { data: queueItem, error: queueError } =
      await supabaseAdmin
        .from("news_queue")
        .select("*")
        .eq("id", queueId)
        .single();

    if (queueError || !queueItem) {
      return NextResponse.json(
        {
          success: false,
          error: queueError?.message || "News queue item not found.",
        },
        { status: 404 }
      );
    }

    if (queueItem.article_id) {
      return NextResponse.json(
        {
          success: false,
          error: "An article has already been generated for this news item.",
          articleId: queueItem.article_id,
        },
        { status: 409 }
      );
    }

    await supabaseAdmin
      .from("news_queue")
      .update({
        status: "GENERATING",
        generated_error: null,
      })
      .eq("id", queueId);

    const sourceContent = [
      `Title: ${queueItem.title || ""}`,
      `Source: ${queueItem.source || ""}`,
      `Summary: ${queueItem.summary || ""}`,
      `URL: ${queueItem.url || ""}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const generatedArticle = await generateArticle(sourceContent);

    let baseSlug = createSlug(generatedArticle.title);

    if (!baseSlug) {
      baseSlug = `article-${Date.now()}`;
    }

    let slug = baseSlug;
    let suffix = 1;

    while (true) {
      const { data: existingArticle, error: slugCheckError } =
        await supabaseAdmin
          .from("articles")
          .select("id")
          .eq("slug", slug)
          .maybeSingle();

      if (slugCheckError) {
        throw slugCheckError;
      }

      if (!existingArticle) {
        break;
      }

      suffix += 1;
      slug = `${baseSlug}-${suffix}`;
    }

    const { data: article, error: articleError } =
      await supabaseAdmin
        .from("articles")
        .insert([
          {
            slug,
            title: generatedArticle.title,
            category: generatedArticle.category,
            paper: generatedArticle.paper,
            why_news: generatedArticle.why_news,
            prelims: generatedArticle.prelims,
            mains: generatedArticle.mains,
            question: generatedArticle.question,
            status: "draft",
          },
        ])
        .select("*")
        .single();

    if (articleError) {
      throw articleError;
    }

    const { error: updateQueueError } = await supabaseAdmin
      .from("news_queue")
      .update({
        status: "DRAFT",
        article_id: article.id,
        generated_at: new Date().toISOString(),
        generated_error: null,
      })
      .eq("id", queueId);

    if (updateQueueError) {
      throw updateQueueError;
    }

    return NextResponse.json({
      success: true,
      message: "Article generated successfully.",
      article,
    });
  } catch (error) {
    console.error("Generate article error:", error);

    if (queueId) {
      await supabaseAdmin
        .from("news_queue")
        .update({
          status: "FAILED",
          generated_error:
            error?.message || "Article generation failed.",
        })
        .eq("id", queueId);
    }

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Article generation failed.",
      },
      { status: 500 }
    );
  }
}