import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    const status = searchParams.get("status");
    const source = searchParams.get("source");
    const search = searchParams.get("search");

    const limitValue = Number(searchParams.get("limit"));
    const limit =
      Number.isFinite(limitValue) && limitValue > 0
        ? Math.min(Math.floor(limitValue), 200)
        : 100;

    let query = supabaseAdmin
      .from("news_queue")
      .select(
        `
        id,
        title,
        source,
        url,
        summary,
        score,
        status,
        created_at
        `
      )
      .order("score", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status && status !== "ALL") {
      query = query.eq("status", status);
    }

    if (source && source !== "ALL") {
      query = query.eq("source", source);
    }

    if (search) {
      query = query.or(
        `title.ilike.%${search}%,source.ilike.%${search}%,summary.ilike.%${search}%`
      );
    }

    const { data, error } = await query;

    if (error) {
      console.error("NEWS QUEUE READ ERROR:", error);

      return NextResponse.json(
        {
          success: false,
          error: error.message,
          news: [],
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      success: true,
      count: data?.length || 0,
      news: data || [],
    });
  } catch (error) {
    console.error("NEWS QUEUE API ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to load news queue",
        news: [],
      },
      {
        status: 500,
      }
    );
  }
}