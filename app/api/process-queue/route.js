import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { generateArticle } from "@/lib/ai/generateArticle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function stripHtml(value) {
  return cleanText(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
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
  const configuredSecret =
    process.env.CRON_SECRET?.trim() || "";

  const authorization =
    request.headers.get("authorization")?.trim() || "";

  if (!configuredSecret) {
    console.error("[Queue processor] CRON_SECRET is missing.");
    return false;
  }

  return authorization === `Bearer ${configuredSecret}`;
}

async function slugExists(supabase, slug) {
  const { data, error } = await supabase
    .from("articles")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Article duplicate check failed: ${error.message}`
    );
  }

  return data || null;
}

function createSourceMaterial(queueItem) {
  const keywords = Array.isArray(queueItem.keywords)
    ? queueItem.keywords
    : [];

  return `
NEWS TITLE

${cleanText(queueItem.title)}

NEWS DESCRIPTION

${stripHtml(queueItem.description) || cleanText(queueItem.title)}

SOURCE

${cleanText(queueItem.source) || "News source"}

SOURCE URL

${cleanText(queueItem.url) || "Not supplied"}

INITIAL UPSC EVALUATION

Category: ${cleanText(queueItem.category) || "General"}
Paper: ${cleanText(queueItem.paper) || "Prelims"}
Importance: ${queueItem.importance || 0}/10
Reason: ${cleanText(queueItem.evaluation_reason) || "Important current-affairs development"}
Keywords: ${keywords.join(", ")}

Prepare the article only from the supplied news information.
Do not invent unsupported facts.
  `.trim();
}

async function getPendingQueueItem(supabase) {
  const { data, error } = await supabase
    .from("article_queue")
    .select("*")
    .eq("status", "pending")
    .lt("attempts", 3)
    .order("importance", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Queue fetch failed: ${error.message}`
    );
  }

  return data;
}

async function claimQueueItem(supabase, queueItem) {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("article_queue")
    .update({
      status: "processing",
      attempts: (queueItem.attempts || 0) + 1,
      processing_started_at: now,
      updated_at: now,
      error: null,
    })
    .eq("id", queueItem.id)
    .eq("status", "pending")
    .select()
    .maybeSingle();

  if (error) {
    throw new Error(
      `Queue claim failed: ${error.message}`
    );
  }

  return data;
}

async function markQueueDuplicate(
  supabase,
  queueItemId,
  articleId
) {
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("article_queue")
    .update({
      status: "duplicate",
      processed_at: now,
      updated_at: now,
      error: "Generated article already exists.",
    })
    .eq("id", queueItemId);

  if (error) {
    throw new Error(
      `Queue duplicate update failed: ${error.message}`
    );
  }

  return articleId;
}

async function markQueuePublished(
  supabase,
  queueItemId,
  articleId
) {
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("article_queue")
    .update({
      status: "published",
      article_id: articleId,
      processed_at: now,
      updated_at: now,
      error: null,
    })
    .eq("id", queueItemId);

  if (error) {
    throw new Error(
      `Queue completion update failed: ${error.message}`
    );
  }
}

async function markQueueFailed(
  supabase,
  queueItem,
  errorMessage
) {
  const attempts = (queueItem.attempts || 0) + 1;
  const shouldRetry = attempts < 3;
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("article_queue")
    .update({
      status: shouldRetry ? "pending" : "failed",
      attempts,
      updated_at: now,
      processed_at: shouldRetry ? null : now,
      error: errorMessage,
    })
    .eq("id", queueItem.id);

  if (error) {
    console.error(
      "[Queue processor] Failed to record queue error:",
      error.message
    );
  }
}

export async function GET(request) {
  const startedAt = Date.now();

  if (!isAuthorised(request)) {
    return NextResponse.json(
      {
        success: false,
        message: "Unauthorised queue processing request.",
      },
      { status: 401 }
    );
  }

  const supabase = createServerSupabase();
  let queueItem = null;

  try {
    queueItem = await getPendingQueueItem(supabase);

    if (!queueItem) {
      return NextResponse.json({
        success: true,
        message: "No pending article exists in the queue.",
        durationMs: Date.now() - startedAt,
      });
    }

    const claimedItem = await claimQueueItem(
      supabase,
      queueItem
    );

    if (!claimedItem) {
      return NextResponse.json({
        success: true,
        message:
          "The queue item was already claimed by another process.",
        durationMs: Date.now() - startedAt,
      });
    }

    const generatedArticle = await generateArticle(
      createSourceMaterial(claimedItem)
    );

    const slug = createSlug(generatedArticle.title);

    if (!slug || slug.length < 5) {
      throw new Error(
        "Generated article has an invalid slug."
      );
    }

    const existingArticle = await slugExists(
      supabase,
      slug
    );

    if (existingArticle) {
      await markQueueDuplicate(
        supabase,
        claimedItem.id,
        existingArticle.id
      );

      return NextResponse.json({
        success: true,
        message: "Queue item skipped because the article exists.",
        result: {
          status: "duplicate",
          queueId: claimedItem.id,
          articleId: existingArticle.id,
          title: generatedArticle.title,
          slug,
        },
        durationMs: Date.now() - startedAt,
      });
    }

    const now = new Date().toISOString();

    const articleData = {
      title: generatedArticle.title,
      slug,
      category:
        generatedArticle.category ||
        claimedItem.category ||
        "General",
      paper:
        generatedArticle.paper ||
        claimedItem.paper ||
        "Prelims",

      content: "",
      why_news: generatedArticle.why_news,
      prelims: generatedArticle.prelims,
      mains: generatedArticle.mains,
      question: generatedArticle.question,

      // Image processing remains separate to keep this request fast.
      image_url: null,
      image_alt: generatedArticle.title,
      image_caption:
        claimedItem.source || "Current Affairs",

      seo_title: generatedArticle.title,
      seo_description: stripHtml(
        generatedArticle.why_news
      ).slice(0, 160),

      tags: Array.isArray(claimedItem.keywords)
        ? claimedItem.keywords
        : [],

      status: "published",
      created_at: now,
      updated_at: now,
    };

    const { data: publishedArticle, error: insertError } =
      await supabase
        .from("articles")
        .insert([articleData])
        .select()
        .single();

    if (insertError) {
      throw new Error(
        `Article insert failed: ${insertError.message}`
      );
    }

    await markQueuePublished(
      supabase,
      claimedItem.id,
      publishedArticle.id
    );

    return NextResponse.json({
      success: true,
      message: "One queued article was published.",
      result: {
        status: "published",
        queueId: claimedItem.id,
        articleId: publishedArticle.id,
        title: publishedArticle.title,
        slug: publishedArticle.slug,
      },
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    const errorMessage =
      error?.message || "Queue processing failed.";

    console.error(
      "[Queue processor] Processing failed:",
      errorMessage
    );

    if (queueItem) {
      await markQueueFailed(
        supabase,
        queueItem,
        errorMessage
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: errorMessage,
        durationMs: Date.now() - startedAt,
      },
      { status: 500 }
    );
  }
}