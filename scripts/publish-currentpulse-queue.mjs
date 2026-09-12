import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { auditCaPdfLiveArticle } from "../lib/pdf/liveQualityGate.js";
import { isSameEvent } from "../lib/news/eventCluster.js";

const QUEUE_DIR = path.resolve("automation/publish-queue");
const SITE_URL = "https://cp.vliab.workers.dev";
const MAX_ARTICLES = 20;
const QUALITY_VERSION = 6;

function clean(value = "") {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

function slugify(value = "") {
  return clean(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 130);
}

function hash(value = "") {
  return createHash("sha256").update(String(value ?? "")).digest("hex");
}

function publishedStamp(date) {
  return `${date}T12:00:00`;
}

function queueSourceKey(queueId, index) {
  return `github-ca:${queueId}:${index}`;
}

function requiredString(value, label) {
  const text = clean(value);
  if (!text) throw new Error(`${label} is required.`);
  return text;
}

function buildPayload(queue, article) {
  const title = requiredString(article.title, "Article title").slice(0, 180);
  const fullText = requiredString(article.fullText, `${title}: fullText`).slice(0, 120000);
  const category = requiredString(article.category || "Polity & Governance", `${title}: category`).slice(0, 80);
  const paper = requiredString(article.paper || "Prelims", `${title}: paper`).slice(0, 30);
  const importIndex = Number(article.importIndex);
  if (!Number.isInteger(importIndex) || importIndex < 0) throw new Error(`${title}: importIndex must be a non-negative integer.`);

  const suffix = `${queue.publishedAt.replace(/-/g, "")}-${hash(queue.queueId).slice(0, 7)}-${importIndex}`;
  const slug = `${slugify(title) || "current-affairs"}-${suffix}`.slice(0, 180);
  const createdAt = `${queue.publishedAt}T12:00:00+05:30`;

  return {
    title,
    slug,
    category,
    paper,
    why_news: fullText.slice(0, 900),
    prelims: "",
    mains: "",
    question: "",
    content: fullText,
    static_foundation: "",
    data_examples: "",
    india_relevance: "",
    syllabus_linkage: `- **Paper:** ${paper}\n- **Theme:** ${category}`,
    seo_title: title,
    seo_description: clean(article.seo_description || fullText).slice(0, 160),
    tags: [...new Set([category, paper, "Current Affairs", "PDF Import", "GitHub Automation"])],
    status: "published",
    language: "en",
    created_at: createdAt,
    updated_at: createdAt,
    published_at: publishedStamp(queue.publishedAt),
    image_alt: title,
    image_search_query: title,
    image_url: null,
    image_source_url: null,
    image_caption: null,
    image_resolution: {
      status: "deferred_after_pdf_publish",
      provider: "deferred",
      requests_used: 0,
    },
    map_locations: Array.isArray(article.map_locations) ? article.map_locations.slice(0, 8) : [],
    quality_score: 100,
    quality_version: QUALITY_VERSION,
    quality_flags: [
      "admin_pdf_import",
      "zero_ai_pdf_import",
      "full_text_preserved",
      "structure_validated",
      "image_resolution_deferred",
      "ca_pdf_import",
      "github_automation_publish",
    ],
    manual_protected: true,
  };
}

async function listQueueFiles() {
  try {
    const names = await fs.readdir(QUEUE_DIR);
    return names.filter((name) => name.endsWith(".json")).sort();
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

const supabaseUrl = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const serviceKey = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
if (!supabaseUrl || !serviceKey) throw new Error("Supabase publishing credentials are missing.");

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const queueFiles = await listQueueFiles();
if (!queueFiles.length) {
  console.log("No trusted CurrentPulse publishing queue files found; skipping.");
  process.exit(0);
}

for (const fileName of queueFiles) {
  const raw = await fs.readFile(path.join(QUEUE_DIR, fileName), "utf8");
  const queue = JSON.parse(raw);
  if (queue?.schema !== "currentpulse-ca-queue-v1") throw new Error(`${fileName}: unsupported queue schema.`);
  queue.queueId = requiredString(queue.queueId, `${fileName}: queueId`);
  queue.publishedAt = requiredString(queue.publishedAt, `${fileName}: publishedAt`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(queue.publishedAt)) throw new Error(`${fileName}: publishedAt must be YYYY-MM-DD.`);
  if (!Array.isArray(queue.articles) || queue.articles.length < 1 || queue.articles.length > MAX_ARTICLES) {
    throw new Error(`${fileName}: queue must contain 1-${MAX_ARTICLES} articles.`);
  }

  const normalized = queue.articles.map((article) => ({
    article,
    importIndex: Number(article.importIndex),
    sourceKey: queueSourceKey(queue.queueId, Number(article.importIndex)),
  }));

  const { data: existingSources, error: sourceLookupError } = await supabase
    .from("article_sources")
    .select("source_key,article_id")
    .in("source_key", normalized.map((item) => item.sourceKey));
  if (sourceLookupError) throw new Error(`${fileName}: duplicate lookup failed: ${sourceLookupError.message}`);

  const existing = new Map((existingSources || []).map((row) => [clean(row.source_key), row.article_id]));
  const pending = normalized.filter((item) => !existing.has(item.sourceKey));
  if (!pending.length) {
    console.log(`${fileName}: all ${normalized.length} articles are already published; idempotent skip.`);
    continue;
  }

  const start = new Date(`${queue.publishedAt}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 7);
  const { data: recent, error: recentError } = await supabase
    .from("articles")
    .select("id,title,why_news,published_at")
    .eq("status", "published")
    .gte("published_at", start.toISOString())
    .lte("published_at", `${queue.publishedAt}T23:59:59`)
    .limit(1000);
  if (recentError) throw new Error(`${fileName}: recent-topic lookup failed: ${recentError.message}`);

  for (const item of pending) {
    if (item.article.allowSimilarEvent === true) continue;
    const candidate = {
      title: item.article.title,
      description: item.article.fullText,
      published_at: publishedStamp(queue.publishedAt),
    };
    const duplicate = (recent || []).find((row) => isSameEvent(candidate, {
      title: row.title,
      description: row.why_news,
      published_at: row.published_at,
    }));
    if (duplicate) {
      throw new Error(`${fileName}: duplicate-event guard blocked \"${item.article.title}\" because it matches published article ${duplicate.id}: ${duplicate.title}`);
    }
  }

  const payloads = pending.map((item) => buildPayload(queue, item.article));
  const { data: inserted, error: insertError } = await supabase
    .from("articles")
    .insert(payloads)
    .select("id,slug,title,content,status,quality_score,quality_version");
  if (insertError) throw new Error(`${fileName}: atomic article insert failed: ${insertError.message}`);

  const insertedRows = inserted || [];
  if (insertedRows.length !== pending.length) {
    const ids = insertedRows.map((row) => row.id).filter(Boolean);
    if (ids.length) await supabase.from("articles").delete().in("id", ids);
    throw new Error(`${fileName}: insert count mismatch; rolled back inserted rows.`);
  }

  try {
    for (const row of insertedRows) {
      if (row.status !== "published" || Number(row.quality_score) !== 100 || Number(row.quality_version) < QUALITY_VERSION) {
        throw new Error(`${row.title}: database quality gate did not return published/100/v${QUALITY_VERSION}+.`);
      }
      const audit = auditCaPdfLiveArticle(row.content || "");
      if (!audit.ok) throw new Error(`${row.title}: JS live quality gate failed: ${audit.problems.join("; ")}`);
    }

    const now = new Date().toISOString();
    const sourceRows = insertedRows.map((row, index) => {
      const item = pending[index];
      return {
        article_id: row.id,
        event_key: hash(`${queue.publishedAt}|${row.title}`).slice(0, 32),
        source_key: item.sourceKey,
        source_kind: "coaching",
        source_name: "CurrentPulse Trusted GitHub CA Queue",
        source_title: `Automated publish ${queue.queueId}`,
        source_url: `${SITE_URL}/current-affairs`,
        source_published_at: `${queue.publishedAt}T12:00:00+05:30`,
        content_hash: hash(item.article.fullText),
        merged_at: now,
        updated_at: now,
      };
    });

    const { error: sourceInsertError } = await supabase.from("article_sources").insert(sourceRows);
    if (sourceInsertError) throw new Error(`source registration failed: ${sourceInsertError.message}`);
  } catch (error) {
    const ids = insertedRows.map((row) => row.id).filter(Boolean);
    if (ids.length) {
      await supabase.from("article_sources").delete().in("article_id", ids);
      await supabase.from("articles").delete().in("id", ids);
    }
    throw new Error(`${fileName}: ${error.message}; inserted rows were removed.`);
  }

  console.log(JSON.stringify({
    queue: fileName,
    requested: normalized.length,
    published: insertedRows.length,
    duplicates: normalized.length - pending.length,
    articles: insertedRows.map((row) => ({ id: row.id, slug: row.slug, title: row.title })),
  }, null, 2));
}
