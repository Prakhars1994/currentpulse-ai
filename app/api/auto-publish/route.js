import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function disabledResponse() {
  return NextResponse.json(
    {
      success: false,
      code: "manual_publishing_only",
      message:
        "Automatic News and Current Affairs collection is permanently disabled. Publish administrator-supplied PDFs/content through the Admin workspace.",
    },
    {
      status: 410,
      headers: { "Cache-Control": "no-store, max-age=0" },
    }
  );
}

export async function GET() {
  return disabledResponse();
}

export async function POST() {
  return disabledResponse();
}
