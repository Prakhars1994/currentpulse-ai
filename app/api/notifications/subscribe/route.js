import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_TOPICS = new Set(["all","news","current_affairs","exam_result","exam_admit_card","exam_notification","exam_answer_key","exam_application","exam_deadline","exam_exam_date","exam_cut_off","exam_counselling"]);
function emailOk(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim()); }
function phoneOk(v) { return /^\+[1-9]\d{7,14}$/.test(String(v || "").replace(/[\s()-]/g, "")); }

export async function POST(request) {
  try {
    const body = await request.json();
    if (String(body.website || "").trim()) return NextResponse.json({ success: true });
    const email = String(body.email || "").trim().toLowerCase();
    const phone = String(body.phone || "").replace(/[\s()-]/g, "");
    const emailEnabled = Boolean(body.emailEnabled);
    const whatsappEnabled = Boolean(body.whatsappEnabled);
    const topics = [...new Set((Array.isArray(body.topics) ? body.topics : []).filter((x) => ALLOWED_TOPICS.has(x)))];
    if (!body.consent) return NextResponse.json({ success: false, message: "Consent is required." }, { status: 400 });
    if (!topics.length) return NextResponse.json({ success: false, message: "Choose at least one alert type." }, { status: 400 });
    if (emailEnabled && !emailOk(email)) return NextResponse.json({ success: false, message: "Enter a valid email address." }, { status: 400 });
    if (whatsappEnabled && !phoneOk(phone)) return NextResponse.json({ success: false, message: "Use WhatsApp number in international format, e.g. +9198..." }, { status: 400 });
    if (!emailEnabled && !whatsappEnabled) return NextResponse.json({ success: false, message: "Choose email or WhatsApp." }, { status: 400 });

    const supabase = createServerSupabase();
    let query = supabase.from("notification_subscriptions").select("id").limit(1);
    if (emailEnabled && email) query = query.eq("email", email);
    else query = query.eq("phone_e164", phone);
    const { data: existing, error: findError } = await query.maybeSingle();
    if (findError && findError.code === "42P01") return NextResponse.json({ success: false, message: "Alerts are being activated. Run the ResultPulse database migration first." }, { status: 503 });
    if (findError) throw findError;
    const payload = { email: email || null, phone_e164: phone || null, email_enabled: emailEnabled, whatsapp_enabled: whatsappEnabled, topics, status: "active", consent_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    const mutation = existing?.id
      ? supabase.from("notification_subscriptions").update(payload).eq("id", existing.id)
      : supabase.from("notification_subscriptions").insert(payload);
    const { error } = await mutation;
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, message: error?.message || "Could not save alerts." }, { status: 500 });
  }
}
