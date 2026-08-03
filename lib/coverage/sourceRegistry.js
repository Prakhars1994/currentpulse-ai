import { createHash } from "node:crypto";
import { normalizeText } from "@/lib/news/eventCluster";

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function hash(value) {
  return createHash("sha256").update(String(value || "")).digest("hex");
}

export function createCoverageSourceReference(input = {}) {
  const sourceName = cleanText(input.source || input.sourceName) || "Trusted UPSC Source";
  const sourceTitle = cleanText(input.title || input.sourceTitle);
  const sourceUrl = cleanText(input.url || input.sourceUrl);
  const summary = cleanText(input.summary || input.description || input.content);
  const publishedAt = input.publishedAt || input.published_at || null;
  const sourceKey =
    cleanText(input.sourceKey) ||
    hash(
      `${sourceName.toLowerCase()}|${sourceUrl.toLowerCase()}|${normalizeText(sourceTitle)}`
    );

  return {
    sourceKey,
    sourceName,
    sourceTitle,
    sourceUrl,
    publishedAt,
    summary,
    contentHash: cleanText(input.contentHash) || hash(summary),
  };
}

export function getCoverageSourceReferences(topic = {}) {
  const inputs = Array.isArray(topic.sourceInputs) && topic.sourceInputs.length
    ? topic.sourceInputs
    : [topic];
  const seen = new Set();

  return inputs
    .map(createCoverageSourceReference)
    .filter((reference) => {
      if (!reference.sourceUrl || seen.has(reference.sourceKey)) return false;
      seen.add(reference.sourceKey);
      return true;
    });
}

export function createCoverageEventKey(topic = {}) {
  const normalizedTitle = normalizeText(topic.title);
  const date = topic.publishedAt ? new Date(topic.publishedAt) : null;
  const cycleDate = date && !Number.isNaN(date.getTime())
    ? date.toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  return hash(`${cycleDate}|${normalizedTitle}`).slice(0, 32);
}

export async function loadMergedSourceKeys(supabase, articleId) {
  const { data, error } = await supabase
    .from("article_sources")
    .select("source_key")
    .eq("article_id", articleId);

  if (error) throw new Error(`Article source lookup failed: ${error.message}`);
  return new Set((data || []).map((row) => row.source_key).filter(Boolean));
}

export async function recordArticleSources(supabase, articleId, topic) {
  const references = getCoverageSourceReferences(topic);
  if (!articleId || references.length === 0) return 0;

  const now = new Date().toISOString();
  const eventKey = topic.eventKey || createCoverageEventKey(topic);
  const rows = references.map((reference) => ({
    article_id: articleId,
    event_key: eventKey,
    source_key: reference.sourceKey,
    source_kind: "coaching",
    source_name: reference.sourceName,
    source_title: reference.sourceTitle || null,
    source_url: reference.sourceUrl,
    source_published_at: reference.publishedAt,
    content_hash: reference.contentHash,
    merged_at: now,
    updated_at: now,
  }));

  const { error } = await supabase
    .from("article_sources")
    .upsert(rows, { onConflict: "source_key", ignoreDuplicates: true });

  if (error) throw new Error(`Article source recording failed: ${error.message}`);
  return rows.length;
}
