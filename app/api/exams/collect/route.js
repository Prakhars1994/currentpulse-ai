import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { collectOfficialExamUpdates } from "@/lib/exams/collector";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function authorised(request) {
  const secret = String(process.env.CRON_SECRET || "").trim();
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request) {
  if (!authorised(request)) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  try {
    const result = await collectOfficialExamUpdates(createServerSupabase());
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ success: false, message: error?.message || "Exam collection failed" }, { status: 500 });
  }
}
