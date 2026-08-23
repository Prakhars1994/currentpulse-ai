import { NextResponse } from "next/server";
import { requireAuthenticatedAdmin } from "@/lib/adminAuth";
import {
  loadTheConversationReviewFeed,
  publishTheConversationArticle,
} from "@/lib/news/theConversation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 150;

const MAX_SELECTED = 8;

export async function GET(request) {
  const auth = await requireAuthenticatedAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const feed = await loadTheConversationReviewFeed({ limit: 40 });

    return NextResponse.json(
      {
        success: true,
        maxSelectable: MAX_SELECTED,
        ...feed,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error?.message || "Unable to load The Conversation review feed.",
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
