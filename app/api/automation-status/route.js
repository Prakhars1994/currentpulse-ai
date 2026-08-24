import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getConfiguredAiProviders } from "@/lib/ai/router";
import { requireAuthenticatedAdmin } from "@/lib/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const COACHING_PIPELINES = ["coaching", "coaching_enrichment"];
const QUEUE_STATUSES = [
  "pending",
  "processing",
  "published",
  "duplicate",
  "failed",
  "rejected",
];

function safeError(value) {
  return String(value || "")
    .replace(/https?:\/\/\S+/gi, "[source URL]")
    .slice(0, 300);
}

async function exactCount(query) {
  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
}

function queueMigrationMessage(error) {
  const message = safeError(error?.message || error);
  if (/pipeline_kind|coverage_event_key|coverage_sources|target_article_id/i.test(message)) {
    return "Run CURRENTPULSE_COVERAGE_QUEUE_MIGRATION.sql in Supabase SQL Editor, then run Auto News again.";
  }
  return "Open this endpoint after the next Auto News and Queue Processor runs; the latest safe error is shown below.";
}

export async function GET(request) {
  const auth = await requireAuthenticatedAdmin(request);
  if (!auth.ok) return auth.response;

  const supabase = createServerSupabase();
  const generatedAt = new Date().toISOString();

  try {
    // This schema probe deliberately uses every column required by the new
    // collector. It turns an otherwise invisible 202/background failure into
    // an immediate and actionable production status.
    const schemaProbe = await supabase
      .from("article_queue")
      .select("id,pipeline_kind,coverage_event_key,coverage_sources,target_article_id")
      .limit(1);
    const runLogProbe = await supabase
      .from("automation_runs")
      .select("id,job_type,status,summary,error,started_at,completed_at")
      .limit(1);

    if (schemaProbe.error || runLogProbe.error) {
      const schemaError = schemaProbe.error || runLogProbe.error;
      return NextResponse.json(
        {
          success: false,
          migrationReady: false,
          problem: safeError(schemaError.message),
          requiredAction: "Run the included CURRENTPULSE_COVERAGE_QUEUE_MIGRATION.sql in Supabase SQL Editor, then run Auto News again.",
          generatedAt,
        },
        { headers: { "Cache-Control": "no-store, max-age=0" } }
      );
    }

    const [sourceRowsResult, latestQueueResult, latestRunsResult, ...queueCounts] = await Promise.all([
      supabase
        .from("article_sources")
        .select("article_id,source_key,source_name,created_at")
        .eq("source_kind", "coaching")
        .order("created_at", { ascending: false })
        .limit(1000),
      supabase
        .from("article_queue")
        .select("id,title,pipeline_kind,status,attempts,error,created_at,updated_at")
        .in("pipeline_kind", COACHING_PIPELINES)
        .order("updated_at", { ascending: false })
        .limit(12),
      supabase
        .from("automation_runs")
        .select("id,job_type,status,summary,error,started_at,completed_at")
        .order("started_at", { ascending: false })
        .limit(8),
      ...QUEUE_STATUSES.map((status) =>
        exactCount(
          supabase
            .from("article_queue")
            .select("id", { count: "exact", head: true })
            .in("pipeline_kind", COACHING_PIPELINES)
            .eq("status", status)
        )
      ),
    ]);

    if (sourceRowsResult.error) throw sourceRowsResult.error;
    if (latestQueueResult.error) throw latestQueueResult.error;
    if (latestRunsResult.error) throw latestRunsResult.error;

    const sourceRows = sourceRowsResult.data || [];
    const latestQueue = (latestQueueResult.data || []).map((row) => ({
      ...row,
      error: safeError(row.error),
    }));
    const queue = Object.fromEntries(
      QUEUE_STATUSES.map((status, index) => [status, queueCounts[index]])
    );
    const coachingArticleIds = new Set(sourceRows.map((row) => row.article_id));
    const sourceNames = [...new Set(sourceRows.map((row) => row.source_name).filter(Boolean))];
    const waiting = queue.pending + queue.processing;
    const failed = queue.failed;
    const requiredAction = waiting > 0
      ? "Run Queue Processor; coaching items are waiting to be generated or merged."
      : failed > 0
        ? "Inspect latestQueue errors below, correct the provider/source failure, then run Auto News."
        : coachingArticleIds.size <= 1
          ? "Run Auto News once. Its response now reports each source count and error instead of only 202 Accepted."
          : "Coaching collection and publishing are operating; refresh Current Affairs after the deployment is Ready.";

    return NextResponse.json(
      {
        success: true,
        migrationReady: true,
        coaching: {
          publishedArticles: coachingArticleIds.size,
          retainedSourceRecords: sourceRows.length,
          sourceNames,
          queue,
        },
        aiProviders: getConfiguredAiProviders(),
        latestQueue,
        latestRuns: (latestRunsResult.data || []).map((run) => ({
          ...run,
          error: safeError(run.error),
        })),
        requiredAction,
        generatedAt,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("[Automation status] Failed:", error?.message || error);

    return NextResponse.json(
      {
        success: false,
        migrationReady: null,
        problem: safeError(error?.message || error),
        requiredAction: queueMigrationMessage(error),
        generatedAt,
      },
      {
        status: 500,
        headers: { "Cache-Control": "no-store, max-age=0" },
      }
    );
  }
}
