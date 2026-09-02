import { NextResponse } from "next/server";
import { requireAuthenticatedAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const auth = await requireAuthenticatedAdmin(request);
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.supabase
    .from("articles")
    .select(
      "id,title,slug,category,paper,status,created_at,updated_at,manual_protected,article_sources!inner(source_kind,source_name,source_key)"
    )
    .eq("article_sources.source_kind", "coaching")
    .like("article_sources.source_key", "pdf:%")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("Admin Current Affairs review fetch error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to load administrator-published Current Affairs." },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { success: true, articles: data || [] },
    { headers: { "Cache-Control": "no-store" } }
  );
}
