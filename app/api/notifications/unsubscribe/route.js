import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
export const dynamic = "force-dynamic";
export async function GET(request) {
  const token = new URL(request.url).searchParams.get("token") || "";
  if (!/^[0-9a-f-]{20,}$/i.test(token)) return NextResponse.json({ success: false, message: "Invalid token" }, { status: 400 });
  const { error } = await createServerSupabase().from("notification_subscriptions").update({ status: "unsubscribed", updated_at: new Date().toISOString() }).eq("unsubscribe_token", token);
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  return NextResponse.redirect(new URL("/exams?alerts=unsubscribed", request.url));
}
