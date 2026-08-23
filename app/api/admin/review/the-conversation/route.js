import { NextResponse } from "next/server";
import { requireAuthenticatedAdmin } from "@/lib/adminAuth";
import {
  conversationArticleId,
  fetchTheConversationRepublish,
  publishTheConversationArticle,
} from "@/lib/news/theConversation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 150;

const MAX_SELECTED = 8;

function previewHtmlWithoutCounter(html = "") {
  // A private admin preview must not create a production republication view.
  // The untouched counter remains in the stored/published HTML.
  return String(html || "").replace(
    /<img\b[^>]*counter\.theconversation\.com[^>]*>/gi,
    ""
  );
}

export async function GET(request) {
  const auth = await requireAuthenticatedAdmin(request);
  if (!auth.ok) return auth.response;

  const searchParams = new URL(request.url).searchParams;
  const previewUrl = String(searchParams.get("preview") || "").trim();

  if (previewUrl) {
    try {
      const article = await fetchTheConversationRepublish(previewUrl);

      return NextResponse.json(
        {
          success: true,
          preview: {
            articleId: article.articleId,
            title: article.title,
            canonical: article.canonical,
            authors: article.authors,
            institutions: article.institutions,
            html: previewHtmlWithoutCounter(article.html),
          },
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          message:
            error?.message || "Unable to load the full Conversation preview.",
        },
        { status: 502 }
      );
    }
  }

  try {
    const { data: marker, error: markerError } = await auth.supabase
      .from("news_queue")
      .select("summary,generated_at,reason")
      .eq("source", "The Conversation")
      .eq("status", "review_batch")
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (markerError) {
      throw new Error(
        `Conversation review marker lookup failed: ${markerError.message}`
      );
    }

    if (!marker) {
      return NextResponse.json(
        {
          success: true,
          maxSelectable: MAX_SELECTED,
          source: "The Conversation",
          items: [],
          stats: {
            available: 0,
            alreadyPublished: 0,
          },
          message:
            "No scheduled Conversation review batch exists yet. Scheduled refreshes run at 10:00, 15:00 and 21:00 IST.",
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    let batch = {};
    try {
      batch = JSON.parse(marker.summary || "{}");
    } catch {
      batch = {};
    }

    const windowStart = String(batch.windowStart || "");
    const windowEnd = String(batch.windowEnd || "");

    if (!windowStart || !windowEnd) {
      throw new Error("Latest Conversation review marker has no valid window.");
    }

    const { data: queueRows, error: queueError } = await auth.supabase
      .from("news_queue")
      .select(
        "id,title,url,summary,created_at,category,keywords,generated_at,reason"
      )
      .eq("source", "The Conversation")
      .eq("status", "review")
      .gte("created_at", windowStart)
      .lt("created_at", windowEnd)
      .order("created_at", { ascending: false })
      .limit(240);

    if (queueError) {
      throw new Error(
        `Conversation review inbox lookup failed: ${queueError.message}`
      );
    }

    const keyedItems = (queueRows || [])
      .map((row) => {
        const articleId = conversationArticleId(row.url);
        return {
          id: row.id,
          articleId,
          sourceKey: articleId
            ? `news:the-conversation:${articleId}`
            : "",
          title: row.title,
          description: row.summary || "",
          url: row.url,
          author: "",
          publishedAt: row.created_at,
          source: "The Conversation",
          edition: row.category || "",
        };
      })
      .filter((item) => item.sourceKey);

    let alreadyPublished = new Set();

    if (keyedItems.length) {
      const { data, error } = await auth.supabase
        .from("article_sources")
        .select("source_key")
        .in(
          "source_key",
          keyedItems.map((item) => item.sourceKey)
        );

      if (error) {
        throw new Error(
          `Conversation published-state lookup failed: ${error.message}`
        );
      }

      alreadyPublished = new Set(
        (data || []).map((row) => String(row.source_key || "")).filter(Boolean)
      );
    }

    const items = keyedItems.filter(
      (item) => !alreadyPublished.has(item.sourceKey)
    );

    return NextResponse.json(
      {
        success: true,
        maxSelectable: MAX_SELECTED,
        source: "The Conversation",
        reviewDate: windowEnd.slice(0, 10),
        window: {
          start: windowStart,
          end: windowEnd,
          finalEnd: batch.finalWindowEnd || "",
          slot: Number(batch.slot) || null,
          refreshedAt: marker.generated_at,
          feedsHealthy: Number(batch.feedsHealthy) || 0,
          feedsRequested: Number(batch.feedsRequested) || 0,
          uniqueInWindow: Number(batch.uniqueInWindow) || keyedItems.length,
        },
        stats: {
          foundInWindow: keyedItems.length,
          alreadyPublished: alreadyPublished.size,
          available: items.length,
        },
        items,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error?.message || "Unable to load The Conversation review inbox.",
      },
      { status: 502 }
    );
  }
}

export async function POST(request) {
  const auth = await requireAuthenticatedAdmin(request);
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const urls = [
    ...new Set(
      (Array.isArray(body?.urls) ? body.urls : [])
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    ),
  ];

  if (!urls.length || urls.length > MAX_SELECTED) {
    return NextResponse.json(
      {
        success: false,
        message: `Select between 1 and ${MAX_SELECTED} The Conversation articles.`,
      },
      { status: 400 }
    );
  }

  const results = [];

  // Deliberately sequential: the licence expects individual editorial
  // selection, and this avoids hammering the source or Supabase.
  for (const url of urls) {
    try {
      results.push(await publishTheConversationArticle(auth.supabase, url));
    } catch (error) {
      results.push({
        status: "failed",
        url,
        error: error?.message || "Republication failed.",
      });
    }
  }

  const published = results.filter(
    (item) => item.status === "published"
  ).length;
  const duplicates = results.filter(
    (item) => item.status === "duplicate"
  ).length;
  const failedResults = results.filter(
    (item) => item.status === "failed"
  );
  const failed = failedResults.length;
  const handled = published + duplicates;
  const success = handled > 0;
  const firstFailure = failedResults[0]?.error || "";

  return NextResponse.json(
    {
      success,
      stats: {
        selected: urls.length,
        published,
        duplicates,
        failed,
      },
      releaseRequired: published > 0,
      message: success
        ? `Published ${published}; duplicates ${duplicates}; failed ${failed}.`
        : `No selected article was published. ${firstFailure}`.trim(),
      results,
    },
    { status: success ? 200 : 502 }
  );
}
