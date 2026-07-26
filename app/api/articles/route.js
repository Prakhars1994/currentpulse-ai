import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";

async function getAuthenticatedAdmin(req) {
  const authorization = req.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return {
      error: NextResponse.json(
        {
          success: false,
          message: "Authentication required.",
        },
        { status: 401 }
      ),
    };
  }

  const accessToken = authorization.replace("Bearer ", "").trim();
  const supabase = createServerSupabase();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(accessToken);

  if (error || !user) {
    return {
      error: NextResponse.json(
        {
          success: false,
          message: "Invalid or expired login session.",
        },
        { status: 401 }
      ),
    };
  }

  const allowedAdminEmail = process.env.ADMIN_EMAIL?.toLowerCase();

  if (
    !allowedAdminEmail ||
    user.email?.toLowerCase() !== allowedAdminEmail
  ) {
    return {
      error: NextResponse.json(
        {
          success: false,
          message: "You are not authorised to manage articles.",
        },
        { status: 403 }
      ),
    };
  }

  return {
    user,
    supabase,
  };
}

export async function POST(req) {
  try {
    const authResult = await getAuthenticatedAdmin(req);

    if (authResult.error) {
      return authResult.error;
    }

    const { supabase } = authResult;
    const body = await req.json();

    const {
      title,
      category,
      paper,
      why_news,
      prelims,
      mains,
      question,
      image,
      status = "draft",
    } = body;

    if (!title?.trim()) {
      return NextResponse.json(
        {
          success: false,
          message: "Article title is required.",
        },
        { status: 400 }
      );
    }

    const allowedStatuses = ["draft", "published"];

    if (!allowedStatuses.includes(status)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid article status.",
        },
        { status: 400 }
      );
    }

    const slug =
      title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-") +
      "-" +
      Date.now();

   const articleData = {
  slug,
  title: title.trim(),
  category: category?.trim() || "",
  paper: paper?.trim() || "",
  why_news: why_news?.trim() || "",
  prelims: prelims?.trim() || "",
  mains: mains?.trim() || "",
  question: question?.trim() || "",
  image: image?.trim() || null,
  status,
  published_at:
    status === "published"
      ? new Date().toISOString()
      : null,
};

    const { data, error } = await supabase
      .from("articles")
      .insert([articleData])
      .select()
      .single();

    if (error) {
      console.error("Supabase article insert error:", error);

      return NextResponse.json(
        {
          success: false,
          message: "Failed to save article.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        status === "published"
          ? "Article published successfully."
          : "Draft saved successfully.",
      article: data,
    });
  } catch (error) {
    console.error("Article API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to save article.",
      },
      { status: 500 }
    );
  }
}