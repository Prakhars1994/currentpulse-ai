import { NextResponse } from "next/server";
import {
  COVERAGE_SOURCE_IDS,
  queueCoverageImport,
} from "@/lib/coverage/queueCoverageImport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DEFAULT_MAX_CANDIDATES = 200;
const MAX_MANUAL_CANDIDATES = 250;

function isAuthorised(request) {
  const configuredSecret = process.env.CRON_SECRET?.trim() || "";
  const authorization = request.headers.get("authorization")?.trim() || "";

  if (!configuredSecret) {
    console.error("[Coverage import] CRON_SECRET is missing.");
    return false;
  }

  return authorization === `Bearer ${configuredSecret}`;
}

export async function GET(request) {
  if (!isAuthorised(request)) {
    return NextResponse.json(
      { success: false, message: "Unauthorised coverage request." },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const requestedSource = (searchParams.get("source") || "all").toLowerCase();
  const parsedLimit = Number.parseInt(searchParams.get("limit") || "", 10);
  const maxCandidates = Number.isFinite(parsedLimit)
    ? Math.min(Math.max(parsedLimit, 1), MAX_MANUAL_CANDIDATES)
    : DEFAULT_MAX_CANDIDATES;

  if (requestedSource !== "all" && !COVERAGE_SOURCE_IDS.includes(requestedSource)) {
    return NextResponse.json(
      {
        success: false,
        message: `Invalid source. Use all or one of: ${COVERAGE_SOURCE_IDS.join(", ")}.`,
      },
      { status: 400 }
    );
  }

  // Collection performs no AI generation, so return its real result. A bare
  // 202 previously hid missing Supabase columns and source-adapter failures.
  try {
    const result = await queueCoverageImport({ requestedSource, maxCandidates });

    return NextResponse.json(result, {
      status: 200,
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    console.error("[Coverage import] Collection failed:", error?.message || error);

    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Coaching coverage collection failed.",
        requestedSource,
        maxCandidates,
      },
      {
        status: 500,
        headers: { "Cache-Control": "no-store, max-age=0" },
      }
    );
  }
}
