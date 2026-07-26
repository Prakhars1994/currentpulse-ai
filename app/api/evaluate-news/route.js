import { NextResponse } from "next/server";
import { evaluateNews } from "@/lib/ai/evaluateNews";

export async function POST(request) {
  try {
    const body = await request.json();

    const title =
      typeof body.title === "string" ? body.title.trim() : "";

    const description =
      typeof body.description === "string"
        ? body.description.trim()
        : "";

    if (!title) {
      return NextResponse.json(
        {
          success: false,
          error: "News title is required.",
        },
        { status: 400 }
      );
    }

    const evaluation = await evaluateNews(
      title,
      description
    );

    return NextResponse.json({
      success: true,
      evaluation,
    });
  } catch (error) {
    console.error("Evaluate news API error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          "Failed to evaluate the news.",
      },
      { status: 500 }
    );
  }
}