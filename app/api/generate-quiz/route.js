import { after, NextResponse } from "next/server";

import { generateDailyQuiz } from "@/lib/quiz/generateDailyQuiz";
import { createServerSupabase } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isAuthorised(request) {
  const secret = process.env.CRON_SECRET?.trim() || "";
  return Boolean(secret) && request.headers.get("authorization")?.trim() === `Bearer ${secret}`;
}

async function execute(force) {
  try {
    const result = await generateDailyQuiz(createServerSupabase(), { force });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[Daily quiz] Generation failed:", error?.message || error);
    return NextResponse.json(
      { success: false, message: error?.message || "Daily quiz generation failed." },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  if (!isAuthorised(request)) {
    return NextResponse.json({ success: false, message: "Unauthorised quiz request." }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const force = params.get("force") === "1";
  if (params.get("wait") === "1") return execute(force);

  after(async () => {
    const response = await execute(force);
    console.log(`[Daily quiz] Background run completed with HTTP ${response.status}.`);
  });

  return NextResponse.json(
    { success: true, accepted: true, message: "UPSC daily quiz generation accepted." },
    { status: 202 }
  );
}
