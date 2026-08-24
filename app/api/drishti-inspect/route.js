import { NextResponse } from "next/server";
import { fetchDrishtiTopics } from "@/lib/coverage/adapters/drishti";
import { requireAuthenticatedAdmin } from "@/lib/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const auth = await requireAuthenticatedAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const topics = await fetchDrishtiTopics();

    return NextResponse.json({
      success: true,
      source: "Drishti IAS",
      fetched: topics.length,
      topics,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Drishti inspection failed.",
      },
      { status: 500 }
    );
  }
}
