import { createServerSupabase } from "@/lib/supabase-server";

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
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

export async function queueCandidate(article, evaluation) {
  const supabase = createServerSupabase();

  const sourceUrl =
    cleanText(article.link) ||
    cleanText(article.url) ||
    cleanText(article.sourceUrl);

  // Skip duplicate URLs already in queue
  if (sourceUrl) {
    const { data: existing } = await supabase
      .from("article_queue")
      .select("id")
      .eq("url", sourceUrl)
      .maybeSingle();

    if (existing) {
      return {
        queued: false,
        reason: "Already queued",
      };
    }
  }

  const { data, error } = await supabase
    .from("article_queue")
    .insert([
      {
        title: cleanText(article.title),
        description: stripHtml(
          article.description ||
            article.summary ||
            article.content ||
            ""
        ),
        url: sourceUrl,
        source:
          cleanText(article.sourceName) ||
          cleanText(article.source) ||
          cleanText(article.publisher),

        source_domain: cleanText(article.sourceDomain),

        published_at:
          article.publishedAt ||
          article.pubDate ||
          null,

       importance: evaluation.importance,
category: evaluation.category || null,
paper: evaluation.paper || null,
evaluation_reason: evaluation.reason || null,
keywords: Array.isArray(evaluation.keywords)
  ? evaluation.keywords
  : [],

status: "pending",
      },
    ])
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return {
    queued: true,
    id: data.id,
  };
}