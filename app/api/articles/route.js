import { NextResponse } from "next/server";
import { requireAuthenticatedAdmin } from "@/lib/adminAuth";
import { assessPublishedArticle } from "@/lib/editorial/publicationSafety";

export const dynamic = "force-dynamic";

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanSlug(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function articlePayload(body) {
  const title = cleanText(body?.title);
  const status = body?.status === "published" ? "published" : "draft";
  const tags = Array.isArray(body?.tags)
    ? body.tags.map(cleanText).filter(Boolean)
    : [];

  return {
    title,
    slug: cleanSlug(body?.slug || title),
    category: cleanText(body?.category),
    paper: cleanText(body?.paper),
    why_news: cleanText(body?.why_news),
    prelims: cleanText(body?.prelims),
    mains: cleanText(body?.mains),
    question: cleanText(body?.question),
    content: cleanText(body?.content),
    image: cleanText(body?.image) || null,
    seo_title: cleanText(body?.seo_title),
    seo_description: cleanText(body?.seo_description).slice(0, 160),
    tags,
    status,
  };
}

function invalidIdResponse() {
  return NextResponse.json(
    {
      success: false,
      message: "A valid article ID is required.",
    },
    { status: 400 }
  );
}

function unsafePublicationResponse(payload, body) {
  if (payload.status !== "published") return null;
  const stream = body?.stream === "news" ? "news" : "coverage";
  const assessment = assessPublishedArticle(payload, { stream });
  if (assessment.allowed) return null;
  return NextResponse.json(
    {
      success: false,
      message: `Publication blocked: ${assessment.reason}`,
      code: assessment.code,
    },
    { status: 422 }
  );
}

export async function GET(request) {
  const auth = await requireAuthenticatedAdmin(request);
  if (!auth.ok) return auth.response;

  const id = new URL(request.url).searchParams.get("id");

  if (id) {
    const numericId = Number(id);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      return invalidIdResponse();
    }

    const { data, error } = await auth.supabase
      .from("articles")
      .select("*")
      .eq("id", numericId)
      .maybeSingle();

    if (error) {
      console.error("Admin article fetch error:", error);
      return NextResponse.json(
        { success: false, message: "Unable to load the article." },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { success: false, message: "Article not found." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: true, article: data },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const { data, error } = await auth.supabase
    .from("articles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Admin articles fetch error:", error);
    return NextResponse.json(
      { success: false, message: "Unable to load articles." },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { success: true, articles: data || [] },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request) {
  try {
    const auth = await requireAuthenticatedAdmin(request);
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const payload = articlePayload(body);
    const safetyResponse = unsafePublicationResponse(payload, body);
    if (safetyResponse) return safetyResponse;

    if (payload.title.length < 5) {
      return NextResponse.json(
        { success: false, message: "Article title is required." },
        { status: 400 }
      );
    }

    if (payload.slug.length < 5) {
      return NextResponse.json(
        { success: false, message: "A valid article slug is required." },
        { status: 400 }
      );
    }

    let { data, error } = await auth.supabase
      .from("articles")
      .insert([payload])
      .select()
      .single();

    if (error?.code === "23505") {
      const uniquePayload = {
        ...payload,
        slug: `${payload.slug}-${Date.now()}`,
      };

      const retry = await auth.supabase
        .from("articles")
        .insert([uniquePayload])
        .select()
        .single();

      data = retry.data;
      error = retry.error;
    }

    if (error) {
      console.error("Supabase article insert error:", error);
      return NextResponse.json(
        { success: false, message: "Failed to save article." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        payload.status === "published"
          ? "Article published successfully."
          : "Draft saved successfully.",
      article: data,
    });
  } catch (error) {
    console.error("Article create API error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to save article." },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const auth = await requireAuthenticatedAdmin(request);
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const id = Number(body?.id);

    if (!Number.isInteger(id) || id <= 0) return invalidIdResponse();

    const payload = articlePayload(body);
    const safetyResponse = unsafePublicationResponse(payload, body);
    if (safetyResponse) return safetyResponse;

    if (payload.title.length < 5 || payload.slug.length < 5) {
      return NextResponse.json(
        { success: false, message: "A valid title and slug are required." },
        { status: 400 }
      );
    }

    const { data, error } = await auth.supabase
      .from("articles")
      .update({
        ...payload,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Supabase article update error:", error);
      return NextResponse.json(
        { success: false, message: "Failed to update article." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Article updated successfully.",
      article: data,
    });
  } catch (error) {
    console.error("Article update API error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to update article." },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  const auth = await requireAuthenticatedAdmin(request);
  if (!auth.ok) return auth.response;

  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return invalidIdResponse();

  const { error } = await auth.supabase
    .from("articles")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Supabase article delete error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to delete article." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Article deleted successfully.",
  });
}
