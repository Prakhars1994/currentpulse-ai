import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { requireAuthenticatedAdmin } from "@/lib/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getIndiaDayRange() {
  const now = new Date();

  const indiaDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  const start = new Date(`${indiaDate}T00:00:00+05:30`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return {
    date: indiaDate,
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

async function exactCount(query) {
  const { count, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return count || 0;
}

export async function GET(request) {
  const auth = await requireAuthenticatedAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const supabase = createServerSupabase();
    const indiaDay = getIndiaDayRange();

    const [
      totalArticles,
      totalPublished,
      publishedToday,
      drafts,
      queuePending,
      queueProcessing,
      queuePublished,
      queueFailed,
      queueDuplicates,
      queueRejected,
    ] = await Promise.all([
      exactCount(
        supabase
          .from("articles")
          .select("id", { count: "exact", head: true })
      ),

      exactCount(
        supabase
          .from("articles")
          .select("id", { count: "exact", head: true })
          .eq("status", "published")
      ),

      exactCount(
        supabase
          .from("articles")
          .select("id", { count: "exact", head: true })
          .eq("status", "published")
          .gte("created_at", indiaDay.start)
          .lt("created_at", indiaDay.end)
      ),

      exactCount(
        supabase
          .from("articles")
          .select("id", { count: "exact", head: true })
          .eq("status", "draft")
      ),

      exactCount(
        supabase
          .from("article_queue")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending")
      ),

      exactCount(
        supabase
          .from("article_queue")
          .select("id", { count: "exact", head: true })
          .eq("status", "processing")
      ),

      exactCount(
        supabase
          .from("article_queue")
          .select("id", { count: "exact", head: true })
          .eq("status", "published")
      ),

      exactCount(
        supabase
          .from("article_queue")
          .select("id", { count: "exact", head: true })
          .eq("status", "failed")
      ),

      exactCount(
        supabase
          .from("article_queue")
          .select("id", { count: "exact", head: true })
          .eq("status", "duplicate")
      ),

      exactCount(
        supabase
          .from("article_queue")
          .select("id", { count: "exact", head: true })
          .eq("status", "rejected")
      ),
    ]);

    return NextResponse.json(
      {
        success: true,
        date: indiaDay.date,
        timezone: "Asia/Kolkata",
        articles: {
          total: totalArticles,
          published: totalPublished,
          publishedToday,
          drafts,
        },
        queue: {
          pending: queuePending,
          processing: queueProcessing,
          published: queuePublished,
          failed: queueFailed,
          duplicate: queueDuplicates,
          rejected: queueRejected,
        },
        generatedAt: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("[Stats API] Failed:", error?.message || error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load CurrentPulse statistics.",
        error: error?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}
