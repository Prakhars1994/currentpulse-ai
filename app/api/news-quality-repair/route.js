import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { parseNewsPresentation } from "@/lib/news/newsPresentation";
import { assessNewsOutputQuality } from "@/lib/news/newsOutputQuality";
import { rebuildPublishedNewsArticle } from "@/lib/publisher/publishArticle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 150;

const MAX_SCAN = 120;
const MAX_REPAIR = 20;
const CONCURRENCY = 3;

function authorised(request) {
  const secret = process.env.CRON_SECRET?.trim() || "";
  const auth = request.headers.get("authorization")?.trim() || "";
  return Boolean(secret) && auth === `Bearer ${secret}`;
}

function needsRepair(article = {}) {
  const flags = Array.isArray(article.quality_flags)
    ? article.quality_flags
    : [];

  if (flags.includes("awaiting_ai_copy_upgrade")) return true;

  const presentation = parseNewsPresentation(article.content);
  if (!presentation) return true;

  const quality = assessNewsOutputQuality(article);
  if (!quality.allowed) return true;

  return (
    String(presentation.lead || "").trim().length < 100 ||
    String(presentation.keyFacts || "").trim().length < 90 ||
    String(presentation.context || "").trim().length < 90
  );
}

async function mapWithConcurrency(items, limit, handler) {
  const results = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const current = index++;
      results[current] = await handler(items[current], current);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(limit, items.length) },
      () => worker()
    )
  );

  return results;
}

export async function GET(request) {
  if (!authorised(request)) {
    return NextResponse.json(
      { success: false, message: "Unauthorised News repair request." },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const apply = ["1", "true", "yes"].includes(
    String(searchParams.get("apply") || "").toLowerCase()
  );
  const repairLimit = Math.min(
    MAX_REPAIR,
    Math.max(1, Number(searchParams.get("limit")) || MAX_REPAIR)
  );

  const cursor = Math.max(0, Number(searchParams.get("cursor")) || 0);
  const supabase = createServerSupabase();

  let query = supabase
    .from("articles")
    .select(
      "id,title,slug,category,content,why_news,static_foundation,data_examples,india_relevance,quality_flags,created_at,article_sources!inner(source_kind,source_name,source_title,source_url,source_published_at)"
    )
    .eq("status", "published")
    .eq("article_sources.source_kind", "news")
    .order("id", { ascending: false })
    .limit(MAX_SCAN);
  if (cursor > 0) query = query.lt("id", cursor);
  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { success: false, message: `News repair scan failed: ${error.message}` },
      { status: 500 }
    );
  }

  const allCandidates = (data || []).filter(needsRepair);
  const candidates = allCandidates.slice(0, repairLimit);
  let nextCursor = null;
  if (allCandidates.length > candidates.length && candidates.length) {
    nextCursor = Number(candidates.at(-1)?.id || 0) || null;
  } else if ((data || []).length === MAX_SCAN) {
    nextCursor = Number((data || []).at(-1)?.id || 0) || null;
  }

  if (!apply) {
    return NextResponse.json({
      success: true,
      mode: "dry_run",
      scanned: data?.length || 0,
      candidates: candidates.length,
      cursor: cursor || null,
      nextCursor,
      articles: candidates.map((article) => ({
        id: article.id,
        slug: article.slug,
        title: article.title,
      })),
    });
  }

  const results = await mapWithConcurrency(
    candidates,
    CONCURRENCY,
    async (article) => {
      const source = (article.article_sources || []).find(
        (item) => item?.source_kind === "news"
      );

      if (!source?.source_url) {
        return {
          id: article.id,
          title: article.title,
          status: "skipped",
          reason: "No retained News source URL.",
        };
      }

      try {
        const rebuilt = await rebuildPublishedNewsArticle(
          supabase,
          article.id,
          source
        );

        return {
          id: article.id,
          title: article.title,
          status: "rebuilt",
          slug: rebuilt.slug,
        };
      } catch (error) {
        return {
          id: article.id,
          title: article.title,
          status: "failed",
          reason: error?.message || "News rebuild failed.",
        };
      }
    }
  );

  return NextResponse.json({
    success: true,
    mode: "applied",
    scanned: data?.length || 0,
    candidates: candidates.length,
    cursor: cursor || null,
    nextCursor,
    rebuilt: results.filter((item) => item.status === "rebuilt").length,
    skipped: results.filter((item) => item.status === "skipped").length,
    failed: results.filter((item) => item.status === "failed").length,
    results,
  });
}
