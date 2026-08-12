import { createServerSupabase } from "@/lib/supabase-server";
import { isSameEvent } from "@/lib/news/eventCluster";

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

function queuePayload(article, evaluation, status) {
  const sourceUrl =
    cleanText(article.link) || cleanText(article.url) || cleanText(article.sourceUrl);

  return {
    title: cleanText(article.title),
    description: stripHtml(
      article.description || article.summary || article.content || ""
    ),
    url: sourceUrl,
    source:
      cleanText(article.sourceName) ||
      cleanText(article.source) ||
      cleanText(article.publisher),
    source_domain: cleanText(article.sourceDomain),
    image_url: cleanText(article.imageUrl || article.image_url || article.image) || null,
    published_at: article.publishedAt || article.pubDate || null,
    importance: Number(evaluation.importance) || 1,
    category: evaluation.category || null,
    paper: evaluation.paper || null,
    evaluation_reason: evaluation.reason || null,
    keywords: Array.isArray(evaluation.keywords) ? evaluation.keywords : [],
    status,
  };
}

async function findExistingByUrl(supabase, sourceUrl) {
  if (!sourceUrl) return null;
  const { data, error } = await supabase
    .from("article_queue")
    .select("id, status, error")
    .eq("url", sourceUrl)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Queue URL check failed: ${error.message}`);
  return data || null;
}

async function findExistingEvent(supabase, payload) {
  const cutoff = new Date(Date.now() - 21 * 86400000).toISOString();
  const { data, error } = await supabase
    .from("article_queue")
    .select("id, title, description, published_at, status")
    .in("status", ["pending", "processing", "published", "duplicate"])
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) throw new Error(`Queue event check failed: ${error.message}`);

  return (data || []).find((existing) =>
    isSameEvent(
      {
        title: payload.title,
        description: payload.description,
        publishedAt: payload.published_at,
      },
      {
        title: existing.title,
        description: existing.description,
        publishedAt: existing.published_at,
      }
    )
  );
}

export async function queueCandidate(article, evaluation, options = {}) {
  const supabase = options.supabase || createServerSupabase();
  const status = options.status === "rejected" ? "rejected" : "pending";
  const payload = queuePayload(article, evaluation, status);

  if (!payload.title) {
    return { queued: false, preserved: false, reason: "Candidate has no title" };
  }

  const existingByUrl = await findExistingByUrl(supabase, payload.url);

  if (existingByUrl) {
    if (existingByUrl.status === "rejected" && status === "pending") {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("article_queue")
        .update({ ...payload, status: "pending", updated_at: now, error: null })
        .eq("id", existingByUrl.id);

      if (error) throw new Error(`Rejected candidate reactivation failed: ${error.message}`);
      return { queued: true, reactivated: true, id: existingByUrl.id };
    }

    return {
      queued: false,
      preserved:
        existingByUrl.status === "rejected" ||
        String(existingByUrl.error || "").startsWith("AI_REJECTED:"),
      reason: `Already in queue (${existingByUrl.status})`,
      existingQueueId: existingByUrl.id,
    };
  }

  if (status === "pending" && options.skipEventLookup !== true) {
    const existingEvent = await findExistingEvent(supabase, payload);
    if (existingEvent) {
      return {
        queued: false,
        reason: `Same event already in queue (${existingEvent.status})`,
        existingQueueId: existingEvent.id,
      };
    }
  }

  let { data, error } = await supabase
    .from("article_queue")
    .insert([payload])
    .select()
    .single();

  let fallbackStatus = null;

  if (error && status === "rejected") {
    const now = new Date().toISOString();
    const fallback = await supabase
      .from("article_queue")
      .insert([
        {
          ...payload,
          status: "failed",
          error: `AI_REJECTED: ${payload.evaluation_reason || "Not selected for automatic publication."}`,
          processed_at: now,
          updated_at: now,
        },
      ])
      .select()
      .single();

    data = fallback.data;
    error = fallback.error;
    fallbackStatus = error ? null : "failed";
  }

  if (error) throw new Error(error.message);

  return {
    queued: status === "pending",
    preserved: status === "rejected",
    fallbackStatus,
    id: data.id,
  };
}
