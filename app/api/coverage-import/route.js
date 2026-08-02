import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { fetchVisionTopics } from "@/lib/coverage/adapters/vision";
import { publishArticle } from "@/lib/publisher/publishArticle";
import { fetchDrishtiTopics } from "@/lib/coverage/adapters/drishti";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DEFAULT_MAX_PUBLISHES_PER_RUN = 1;
const MAX_ALLOWED_PUBLISHES_PER_RUN = 5;

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function createSlug(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 180);
}

function isAuthorised(request) {
  const configuredSecret =
    process.env.CRON_SECRET?.trim() || "";

  const authorization =
    request.headers.get("authorization")?.trim() || "";

  if (!configuredSecret) {
    console.error(
      "[Coverage import] CRON_SECRET is missing."
    );

    return false;
  }

  return authorization === `Bearer ${configuredSecret}`;
}

async function publishedTopicExists(supabase, title) {
  const slug = createSlug(title);

  if (!slug) {
    return false;
  }

  const { data, error } = await supabase
    .from("articles")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Published coverage check failed: ${error.message}`
    );
  }

  return Boolean(data);
}

function toPublishingSource(topic) {
  return {
    title: topic.title,
    description: topic.summary,
    content: topic.summary,
    url: topic.url,

source: topic.source || "Trusted UPSC Source",
    sourceName: topic.source || "Trusted UPSC Source",

    publishedAt: topic.publishedAt,

    category: topic.category || "General",
    paper: topic.paper || "Prelims",

    importance: 10,

    evaluation_reason:
  `Selected by trusted UPSC current-affairs source ${
    topic.source || "Trusted UPSC Source"
  }.`,
    keywords: Array.isArray(topic.keywords)
      ? topic.keywords
      : [],

    image_url: topic.imageUrl || null,

    trustedCoverage: true,
    generationMode: "trusted_coverage",
  };
}

export async function GET(request) {
  const startedAt = Date.now();

  if (!isAuthorised(request)) {
    return NextResponse.json(
      {
        success: false,
        message:
          "Unauthorised coverage publishing request.",
      },
      { status: 401 }
    );
  }

  try {
    const supabase = createServerSupabase();
    const { searchParams } = new URL(request.url);
    const requestedSource = (searchParams.get("source") || "all").toLowerCase();
    const requestedLimit = Number.parseInt(searchParams.get("limit") || "", 10);
    const maxPublishesPerRun = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), MAX_ALLOWED_PUBLISHES_PER_RUN)
      : DEFAULT_MAX_PUBLISHES_PER_RUN;

    if (!["all", "vision", "drishti"].includes(requestedSource)) {
      return NextResponse.json(
        { success: false, message: "Invalid source. Use all, vision, or drishti." },
        { status: 400 }
      );
    }

    const [visionTopics, drishtiTopics] = await Promise.all([
      requestedSource === "all" || requestedSource === "vision"
        ? fetchVisionTopics()
        : Promise.resolve([]),
      requestedSource === "all" || requestedSource === "drishti"
        ? fetchDrishtiTopics()
        : Promise.resolve([]),
    ]);

    const topics = [...visionTopics, ...drishtiTopics];
    const results = [];
    let publishedCount = 0;

    for (const topic of topics) {
      try {
        if (
          await publishedTopicExists(
            supabase,
            topic.title
          )
        ) {
          results.push({
            status: "already_published",
            title: topic.title,
          });

          continue;
        }

        if (
          publishedCount >= maxPublishesPerRun
        ) {
          results.push({
            status: "waiting_for_next_run",
            title: topic.title,
          });

          continue;
        }

        const published = await publishArticle(
          supabase,
          toPublishingSource(topic)
        );

        if (published.status === "duplicate") {
          results.push({
            status: "duplicate",
            title: topic.title,
            articleId: published.articleId,
            slug: published.slug,
          });

          continue;
        }

        publishedCount += 1;

        results.push({
          status: "published",
          sourceTitle: topic.title,
          articleId: published.articleId,
          title: published.title,
          slug: published.slug,
          category: published.category,
          paper: published.paper,
        });
      } catch (error) {
        console.error(
          `[Coverage import] Failed for "${topic.title}":`,
          error?.message || error
        );

        results.push({
          status: "failed",
          title: topic.title,
          error:
            error?.message ||
            "Trusted coverage publishing failed.",
        });
      }
    }

    const alreadyPublished = results.filter(
      (result) =>
        result.status === "already_published"
    ).length;

    const duplicate = results.filter(
      (result) => result.status === "duplicate"
    ).length;

    const waitingForNextRun = results.filter(
      (result) =>
        result.status === "waiting_for_next_run"
    ).length;

    const failed = results.filter(
      (result) => result.status === "failed"
    ).length;

    return NextResponse.json({
      success: true,
      requestedSource,
      maxPublishesPerRun,
      sources: {
  vision: visionTopics.length,
  drishti: drishtiTopics.length,
},
      fetched: topics.length,
      published: publishedCount,
      alreadyPublished,
      duplicate,
      waitingForNextRun,
      failed,
      durationMs: Date.now() - startedAt,
      results,
    });
  } catch (error) {
    console.error(
      "[Coverage import] Unexpected failure:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Trusted coverage publishing failed.",
        durationMs: Date.now() - startedAt,
      },
      { status: 500 }
    );
  }
}