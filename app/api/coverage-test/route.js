import { NextResponse } from "next/server";
import { fetchVisionTopics } from "@/lib/coverage/adapters/vision";
import { fetchDrishtiTopics } from "@/lib/coverage/adapters/drishti";
import { fetchGkTodayTopics } from "@/lib/coverage/adapters/gktoday";
import { normalizeTopic } from "@/lib/coverage/topicNormalizer";
import { deduplicateCoverageTopics } from "@/lib/coverage/duplicateDetector";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADAPTERS = {
  vision: {
    name: "Vision IAS",
    fetchTopics: fetchVisionTopics,
  },
  drishti: {
    name: "Drishti IAS",
    fetchTopics: fetchDrishtiTopics,
  },
  gktoday: {
    name: "GKToday",
    fetchTopics: fetchGkTodayTopics,
  },
};

export async function GET(request) {
  try {
    const source =
      new URL(request.url).searchParams.get("source")?.trim().toLowerCase() ||
      "vision";

    const adapter = ADAPTERS[source];

    if (!adapter) {
      return NextResponse.json(
        {
          success: false,
          message: `Unsupported coverage source: ${source}`,
          supportedSources: Object.keys(ADAPTERS),
        },
        { status: 400 }
      );
    }

    const rawTopics = await adapter.fetchTopics();
    const normalized = rawTopics.map(normalizeTopic);
    const unique = deduplicateCoverageTopics(normalized);

    return NextResponse.json({
      success: true,
      source: adapter.name,
      fetched: rawTopics.length,
      unique: unique.length,
      results: unique.map((topic) => ({
        source: topic.source,
        title: topic.title,
        summary: topic.summary,
        url: topic.url,
        publishedAt: topic.publishedAt,
        category: topic.category,
        paper: topic.paper,
        imageUrl: topic.imageUrl || null,
        priority: 10,
        trusted: true,
        queue: true,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Coverage adapter test failed.",
      },
      { status: 500 }
    );
  }
}
