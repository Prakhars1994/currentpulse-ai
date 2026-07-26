import { NextResponse } from "next/server";
import { generateArticle } from "@/lib/ai/generateArticle";

export async function POST(request) {
  try {
    const body = await request.json();

    const newsUrl = body.newsUrl?.trim() || "";
    const newsText = body.newsText?.trim() || "";

    if (!newsUrl && !newsText) {
      return NextResponse.json(
        {
          success: false,
          error: "Please provide a news URL or news text.",
        },
        { status: 400 }
      );
    }

    const sourceContent = newsText || newsUrl;

    const article = await generateArticle(sourceContent);

    return NextResponse.json({
      success: true,
      article,
    });
  } catch (error) {
    console.error("Generate article API error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate the article.",
      },
      { status: 500 }
    );
  }
}