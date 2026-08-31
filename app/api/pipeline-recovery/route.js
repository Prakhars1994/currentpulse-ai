import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { assessArticleQuality } from "@/lib/ai/articleQuality";
import { inspectCoverageCandidate } from "@/lib/coverage/sourceSanitizer";
import {
  PIPELINE_RECOVERY_LOOKBACK_HOURS,
  isRecoverableCoverageFallback,
  isRecoverableNewsEntailmentRejection,
  recoveredCoverageFlags,
} from "@/lib/automation/pipelineRecoveryPolicy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 150;

function authorised(request) {
  const secret = process.env.CRON_SECRET?.trim() || "";
  const authorization = request.headers.get("authorization")?.trim() || "";
  return Boolean(secret) && authorization === `Bearer ${secret}`;
}

function articleSummary(article = {}) {
  return [
    article.title,
    article.why_news,
    article.static_foundation,
    article.data_examples,
    article.prelims,
    article.mains,
    article.answer_framework,
  ].filter(Boolean).join("\n");
}

export async function GET(request) {
  if (!authorised(request)) {
    return NextResponse.json({ success: false, message: "Unauthorised pipeline recovery request." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const apply = ["1", "true", "yes"].includes((searchParams.get("apply") || "").toLowerCase());
  const cutoff = new Date(Date.now() - PIPELINE_RECOVERY_LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();
  const supabase = createServerSupabase();

  const { data: newsRows, error: newsError } = await supabase
    .from("article_queue")
    .select("id,title,pipeline_kind,status,error,updated_at")
    .eq("status", "rejected")
    .eq("pipeline_kind", "news")
    .gte("updated_at", cutoff)
    .order("updated_at", { ascending: false })
    .limit(300);
  if (newsError) {
    return NextResponse.json({ success: false, message: `News recovery scan failed: ${newsError.message}` }, { status: 500 });
  }

  const recoverableNews = (newsRows || []).filter(isRecoverableNewsEntailmentRejection);
  if (apply && recoverableNews.length) {
    const { error } = await supabase
      .from("article_queue")
      .update({
        status: "pending",
        attempts: 0,
        processing_started_at: null,
        processed_at: null,
        updated_at: now,
        error: "Recovered after News source-entailment field-boundary fix.",
      })
      .in("id", recoverableNews.map((row) => row.id));
    if (error) {
      return NextResponse.json({ success: false, message: `News recovery update failed: ${error.message}` }, { status: 500 });
    }
  }

  const { data: draftRows, error: draftError } = await supabase
    .from("articles")
    .select("id,title,slug,why_news,syllabus_linkage,india_relevance,static_foundation,data_examples,prelims,mains,answer_framework,question,quality_score,quality_flags,quality_version,updated_at,article_sources!inner(source_kind,source_url)")
    .eq("status", "draft")
    .eq("manual_protected", false)
    .eq("article_sources.source_kind", "coaching")
    .gte("updated_at", cutoff)
    .order("updated_at", { ascending: false })
    .limit(100);
  if (draftError) {
    return NextResponse.json({ success: false, message: `CA recovery scan failed: ${draftError.message}` }, { status: 500 });
  }

  const recoverableCoverage = [];
  for (const article of draftRows || []) {
    const quality = assessArticleQuality(article, { mode: "upsc" });
    if (!isRecoverableCoverageFallback(article, quality)) continue;
    const source = article.article_sources?.[0] || {};
    const inspection = inspectCoverageCandidate({
      title: article.title,
      summary: articleSummary(article),
      url: source.source_url,
    });
    if (!inspection.accepted) continue;
    recoverableCoverage.push({ article, quality });
  }

  const coverageErrors = [];
  if (apply) {
    for (const { article, quality } of recoverableCoverage) {
      const { error } = await supabase
        .from("articles")
        .update({
          status: "published",
          quality_score: quality.score,
          quality_flags: recoveredCoverageFlags(article, quality),
          quality_version: Math.max(Number(article.quality_version || 0), 4),
          updated_at: now,
        })
        .eq("id", article.id)
        .eq("status", "draft");
      if (error) coverageErrors.push({ id: article.id, error: error.message });
    }
  }

  return NextResponse.json({
    success: coverageErrors.length === 0,
    mode: apply ? "applied" : "dry_run",
    cutoff,
    news: {
      scanned: newsRows?.length || 0,
      recoverable: recoverableNews.length,
      ids: recoverableNews.map((row) => row.id),
    },
    currentAffairs: {
      scannedDrafts: draftRows?.length || 0,
      recoverable: recoverableCoverage.length,
      ids: recoverableCoverage.map(({ article }) => article.id),
      errors: coverageErrors,
    },
    message: apply
      ? "Recovered rows stranded by the News entailment and CA quality-gate regressions."
      : "Dry run only. Use ?apply=1 to recover only rows matching the known regression signatures.",
  }, { status: coverageErrors.length ? 500 : 200, headers: { "Cache-Control": "no-store, max-age=0" } });
}
