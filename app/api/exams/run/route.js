import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { collectOfficialExamUpdates } from "@/lib/exams/collector";
import { EXAM_OFFICIAL_SOURCES } from "@/lib/exams/sourceCatalog";
import { dispatchNotificationBatch } from "@/lib/notifications/dispatch";
import { selectScheduledExamSources } from "@/lib/automation/schedulePolicy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

function authorised(request) {
  const secret = String(process.env.CRON_SECRET || "").trim();
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request) {
  if (!authorised(request)) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const searchParams = new URL(request.url).searchParams;
  const full = searchParams.get("full") === "1";
  const runner =
    searchParams.get("runner")?.trim().toLowerCase() || "";
  const notificationsEnabled =
    searchParams.get("notifications") !== "0";
  const examBatch = Math.max(
    0,
    Number(searchParams.get("examBatch")) || 0
  );
  const examBatchSize = Math.min(
    6,
    Math.max(2, Number(searchParams.get("examBatchSize")) || 6)
  );

  if (!full && runner !== "github") {
    return NextResponse.json({
      success: true, skipped: true,
      message: "External ResultPulse heartbeat accepted; GitHub Actions owns scheduled scans.",
    }, { headers: { "Cache-Control": "no-store" } });
  }
  const fullBatchCount = Math.max(
    1,
    Math.ceil(EXAM_OFFICIAL_SOURCES.length / examBatchSize)
  );
  const safeExamBatch = Math.min(fullBatchCount - 1, examBatch);
  const selectedSources = full
    ? EXAM_OFFICIAL_SOURCES.slice(
        safeExamBatch * examBatchSize,
        safeExamBatch * examBatchSize + examBatchSize
      )
    : selectScheduledExamSources(EXAM_OFFICIAL_SOURCES);
  const supabase = createServerSupabase();

  try {
    const collection = await collectOfficialExamUpdates(supabase, {
      sources: selectedSources,
    });
    const notifications = notificationsEnabled
      ? await dispatchNotificationBatch(supabase, { eventLimit: 1, subscriberLimit: 150 })
      : { skipped: true };

    return NextResponse.json(
      {
        success: true,
        mode: full ? "full-batch" : "scheduled",
        selectedSources: selectedSources.map((source) => source.id),
        batch: full
          ? {
              index: safeExamBatch,
              size: examBatchSize,
              count: fullBatchCount,
              hasMore: safeExamBatch + 1 < fullBatchCount,
            }
          : null,
        collection,
        notifications,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error?.message || "ResultPulse run failed" },
      { status: 500 }
    );
  }
}
