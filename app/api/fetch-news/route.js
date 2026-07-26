import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

export async function POST(req) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json(
        {
          success: false,
          error: "URL is required.",
        },
        { status: 400 }
      );
    }

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/137.0 Safari/537.36",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error: "Unable to fetch the webpage.",
        },
        { status: 400 }
      );
    }

    const html = await response.text();

    const $ = cheerio.load(html);

    // Remove unwanted elements
    $(
      "script, style, noscript, header, footer, nav, aside, iframe, svg"
    ).remove();

    // Try common article containers
    let articleText =
      $("article").text() ||
      $(".article").text() ||
      $(".story").text() ||
      $(".content").text() ||
      $("main").text() ||
      $("body").text();

    articleText = articleText
      .replace(/\s+/g, " ")
      .trim();

    if (articleText.length > 12000) {
      articleText = articleText.substring(0, 12000);
    }

    return NextResponse.json({
      success: true,
      text: articleText,
    });
  } catch (error) {
    console.error("Fetch News Error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch article.",
      },
      { status: 500 }
    );
  }
}