import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      success: false,
      code: "manual_publishing_only",
      message:
        "PIB/today News collection is permanently disabled. Publish administrator-supplied News PDFs/content through Admin.",
    },
    {
      status: 410,
      headers: { "Cache-Control": "no-store, max-age=0" },
    }
  );
}
