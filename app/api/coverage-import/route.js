import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      success: false,
      code: "manual_publishing_only",
      message:
        "Coaching-source Current Affairs collection is permanently disabled. Upload administrator-supplied Current Affairs PDFs/content instead.",
    },
    {
      status: 410,
      headers: { "Cache-Control": "no-store, max-age=0" },
    }
  );
}
