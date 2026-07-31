import { NextResponse } from "next/server";
import { NEWS_SOURCES, UPSC_QUERY_TERMS } from "@/lib/news/sourceCatalog";
import { fetchSourceRss } from "@/lib/news/rss";
import { extractImageFromArticle } from "@/lib/news/imageExtractor";
import { deduplicateArticles } from "@/lib/news/filter";
import { evaluateNewsBatch } from "@/lib/ai/evaluateNews";
import { generateArticle } from "@/lib/ai/generateArticle";
import { createServerSupabase } from "@/lib/supabase-server";
import { isSameEvent } from "@/lib/news/eventCluster";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const PER_SOURCE_LIMIT = 8;
const EVALUATION_LIMIT = 30;
const MINIMUM_IMPORTANCE = 5;
const MAX_ARTICLES_PER_RUN = 10;

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

function stripHtml(value) {
  return cleanText(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function isAuthorised(request) {
  const configuredSecret = process.env.CRON_SECRET?.trim() || "";
  const authorization = request.headers.get("authorization")?.trim() || "";

  const expectedAuthorization = `Bearer ${configuredSecret}`;

    if (!configuredSecret) {
    console.error("CRON_SECRET is missing.");
    return false;
  }

  return authorization === expectedAuthorization;
}

function createSourceMaterial(article, evaluation) {
  const title = cleanText(article.title);
  const description = stripHtml(
    article.description ||
      article.content ||
      article.summary ||
      article.snippet ||
      ""
  );

  const sourceName =
    cleanText(article.sourceName) ||
    cleanText(article.source) ||
    cleanText(article.publisher) ||
    "News source";

  const sourceUrl =
    cleanText(article.link) ||
    cleanText(article.url) ||
    cleanText(article.sourceUrl);

  return `
NEWS TITLE

${title}

NEWS DESCRIPTION

${description || title}

SOURCE

${sourceName}

SOURCE URL

${sourceUrl || "Not supplied"}

INITIAL UPSC EVALUATION

Category: ${evaluation.category}
Paper: ${evaluation.paper}
Importance: ${evaluation.importance}/10
Reason: ${evaluation.reason}
Keywords: ${evaluation.keywords.join(", ")}

Prepare the article only from the supplied news information. Do not claim
details that are not supported by the title or description.
  `.trim();
}

async function collectNews() {
  const sourceResults = await Promise.all(
    NEWS_SOURCES.map(async (source) => {
      try {
        const result = await fetchSourceRss(source, UPSC_QUERY_TERMS);

        return result.articles.slice(0, PER_SOURCE_LIMIT);
      } catch (error) {
        console.error(
          `[Auto publish] Source ${source.name || source.id} failed:`,
          error?.message || error
        );

        return [];
      }
    })
  );

  return deduplicateArticles(sourceResults.flat());
}

async function slugExists(supabase, slug) {
  const { data, error } = await supabase
    .from("articles")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Duplicate check failed for "${slug}": ${error.message}`
    );
  }

  return Boolean(data);
}




async function eventExists(supabase, newsArticle) {
  const publishedAt =
    newsArticle.publishedAt ||
    newsArticle.pubDate ||
    newsArticle.created_at ||
    new Date().toISOString();

  const eventDate = new Date(publishedAt);

  if (Number.isNaN(eventDate.getTime())) {
    return false;
  }

  const startDate = new Date(eventDate);
  startDate.setUTCHours(0, 0, 0, 0);

  const endDate = new Date(eventDate);
  endDate.setUTCHours(23, 59, 59, 999);

  const { data, error } = await supabase
    .from("articles")
    .select("id, title, why_news, created_at")
    .gte("created_at", startDate.toISOString())
    .lte("created_at", endDate.toISOString())
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(
      `Event duplicate check failed: ${error.message}`
    );
  }

  return (data || []).some((existingArticle) =>
    isSameEvent(
      {
        title: newsArticle.title || "",
        description:
          newsArticle.description ||
          newsArticle.summary ||
          newsArticle.content ||
          "",
        publishedAt,
      },
      {
        title: existingArticle.title || "",
        description: existingArticle.why_news || "",
        publishedAt: existingArticle.created_at,
      }
    )
  );
}

async function findBestCandidate(supabase, articles) {
  const candidates = articles.slice(0, EVALUATION_LIMIT);
  const eligibleCandidates = [];

  // First remove invalid headlines and existing articles.
  // This avoids wasting Gemini calls on duplicates.
  for (const article of candidates) {
    try {
      const preliminarySlug = createSlug(article.title);

      if (!preliminarySlug || preliminarySlug.length < 5) {
        continue;
      }
if (await slugExists(supabase, preliminarySlug)) {
  console.log(
    `[Auto publish] Skipping existing headline: ${article.title}`
  );

  continue;
}

if (await eventExists(supabase, article)) {
  console.log(
    `[Auto publish] Skipping duplicate event: ${article.title}`
  );

  continue;
}

eligibleCandidates.push(article);
    } catch (error) {
      console.error(
        `[Auto publish] Candidate check failed for "${article.title}":`,
        error?.message || error
      );
    }
  }

  if (eligibleCandidates.length === 0) {
    return [];
  }

  console.log(
    `[Auto publish] Batch evaluating ${eligibleCandidates.length} new candidates.`
  );

  const evaluations = await evaluateNewsBatch(
    eligibleCandidates.map((article) => ({
      title: article.title,
      description:
        article.description ||
        article.content ||
        article.summary ||
        article.title,
    }))
  );

  const evaluatedCandidates = [];

  for (
    let index = 0;
    index < eligibleCandidates.length;
    index += 1
  ) {
    const article = eligibleCandidates[index];
    const evaluation = evaluations[index];

    if (!evaluation) {
      console.warn(
        `[Auto publish] No evaluation returned for: ${article.title}`
      );

      continue;
    }

    if (
      !evaluation.relevant ||
      evaluation.importance < MINIMUM_IMPORTANCE
    ) {
      continue;
    }

    evaluatedCandidates.push({
      article,
      evaluation,
    });
  }

  evaluatedCandidates.sort(
    (first, second) =>
      second.evaluation.importance -
      first.evaluation.importance
  );

  return evaluatedCandidates;
}

async function publishCandidate(supabase, candidate) {
  const { article: newsArticle, evaluation } = candidate;

  let resolvedImageUrl = cleanText(newsArticle.imageUrl);

  if (!resolvedImageUrl) {
    const publisherUrl =
      cleanText(newsArticle.link) ||
      cleanText(newsArticle.url) ||
      cleanText(newsArticle.sourceUrl);

    if (publisherUrl) {
      console.log(
        `[Auto publish] RSS image missing. Checking article page: ${newsArticle.title}`
      );

     resolvedImageUrl = await extractImageFromArticle(
  publisherUrl,
  newsArticle.sourceDomain,
  newsArticle.title
);



      if (resolvedImageUrl) {
        console.log(
          `[Auto publish] Publisher image found: ${resolvedImageUrl}`
        );
      } else {
        console.log(
          `[Auto publish] No publisher image found for: ${newsArticle.title}`
        );
      }
    }
  }

  const sourceMaterial = createSourceMaterial(
    newsArticle,
    evaluation
  );  const generatedArticle = await generateArticle(sourceMaterial);

  const slug = createSlug(generatedArticle.title);

  if (!slug || slug.length < 5) {
    throw new Error("Generated article has an invalid slug.");
  }

  if (await slugExists(supabase, slug)) {
    return {
      status: "skipped",
      reason: "Generated article already exists.",
      title: generatedArticle.title,
      slug,
    };
  }

  const now = new Date().toISOString();

  const articleData = {
  title: generatedArticle.title,
  slug,
  category: generatedArticle.category || evaluation.category,
  paper: generatedArticle.paper || evaluation.paper,

  content: "",

  why_news: generatedArticle.why_news,
  prelims: generatedArticle.prelims,
  mains: generatedArticle.mains,
  question: generatedArticle.question,

image_url: resolvedImageUrl || null,
  image_alt: generatedArticle.title,
  image_caption: newsArticle.source || "News Image",

  seo_title: generatedArticle.title,
  seo_description: stripHtml(
    generatedArticle.why_news
  ).slice(0, 160),

  tags:
    evaluation.keywords?.length > 0
      ? evaluation.keywords
      : [],

  status: "published",
  updated_at: now,
  created_at: now,
};

  const { data, error } = await supabase
    .from("articles")
    .insert([articleData])
    .select()
    .single();

  if (error) {
    throw new Error(`Article insert failed: ${error.message}`);
  }

  return {
    status: "published",
    id: data.id,
    title: data.title,
    slug: data.slug,
    category: data.category,
    paper: data.paper,
  };
}

export async function GET(request) {
  const startedAt = Date.now();

  if (!isAuthorised(request)) {
    return NextResponse.json(
      {
        success: false,
        message: "Unauthorised automatic publishing request.",
      },
      { status: 401 }
    );
  }

  try {
    const supabase = createServerSupabase();

    console.log("[Auto publish] Starting news collection.");

    const collectedArticles = await collectNews();

    if (collectedArticles.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No news articles were collected.",
        stats: {
          collected: 0,
          relevantCandidates: 0,
          published: 0,
          durationMs: Date.now() - startedAt,
        },
      });
    }

    const candidates = await findBestCandidate(
      supabase,
      collectedArticles
    );

    if (candidates.length === 0) {
      return NextResponse.json({
        success: true,
        message:
          "News was collected, but no new sufficiently important UPSC article was found.",
        stats: {
          collected: collectedArticles.length,
          relevantCandidates: 0,
          published: 0,
          durationMs: Date.now() - startedAt,
        },
      });
    }

    const results = [];

    for (const candidate of candidates.slice(
      0,
      MAX_ARTICLES_PER_RUN
    )) {
      try {



        const result = await publishCandidate(
          supabase,
          candidate
        );

        results.push(result);
      } catch (error) {
        console.error(
          `[Auto publish] Publishing failed for "${candidate.article.title}":`,
          error?.message || error
        );

        results.push({
          status: "failed",
          title: candidate.article.title,
          error: error?.message || "Publishing failed.",
        });
      }
    }

    const publishedCount = results.filter(
      (result) => result.status === "published"
    ).length;

    return NextResponse.json({
      success: true,
      message:
        publishedCount > 0
          ? `${publishedCount} current-affairs article published automatically.`
          : "The automatic run completed, but no article was published.",
      stats: {
        collected: collectedArticles.length,
        relevantCandidates: candidates.length,
        published: publishedCount,
        durationMs: Date.now() - startedAt,
      },
      results,
    });
  } catch (error) {
    console.error(
      "[Auto publish] Unexpected failure:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Unexpected automatic publishing failure.",
        durationMs: Date.now() - startedAt,
      },
      { status: 500 }
    );
  }
}



