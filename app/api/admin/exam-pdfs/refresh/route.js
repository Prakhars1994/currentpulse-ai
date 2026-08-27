import { NextResponse } from "next/server";
import { requireAuthenticatedAdmin } from "@/lib/adminAuth";
import { requestReaderRelease } from "@/lib/publisher/requestReaderRelease";
import { readerReleaseReason } from "@/lib/publisher/readerReleaseResult";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  const auth = await requireAuthenticatedAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    await requestReaderRelease({ articleId: `exam-pdf-manual-${Date.now()}`, stream: "pdf" });
    return NextResponse.json({ success: true, releaseQueued: true, readerRefresh: { queued: true, reason: null } });
  } catch (error) {
    const reason = readerReleaseReason(error);
    console.error("Manual Exam PDF reader refresh not queued:", reason);
    return NextResponse.json({ success: true, releaseQueued: false, readerRefresh: { queued: false, reason } });
  }
}
