import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import {
  conversationArticleId,
  loadTheConversationReviewWindow,
} from "../lib/news/theConversation.js";
import { isGeneralPublicConversationItem } from "../lib/news/conversationPublicInterest.js";

const IST_OFFSET_MS = 330 * 60 * 1000;
const SOURCE_NAME = "The Conversation";
const REVIEW_STATUS = "review";
const MARKER_STATUS = "review_batch";
const MAX_ROWS_PER_WINDOW = 240;
const RETAIN_REVIEW_DAYS = 4;

function arg(name, fallback = "") {
  const index = process.argv.indexOf(name);
  if (index < 0 || index + 1 >= process.argv.length) return fallback;
  return process.argv[index + 1];
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function toIstParts(date = new Date()) {
  const shifted = new Date(date.getTime() + IST_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
  };
}

function istDateToUtc({ year, month, day }, hour) {
  return new Date(
    Date.UTC(year, month, day, hour, 0, 0, 0) - IST_OFFSET_MS
  );
}

function addIstDays(parts, days) {
  const shifted = new Date(
    Date.UTC(parts.year, parts.month, parts.day + days, 12, 0, 0)
  );
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
  };
}

export function conversationReviewWindow(slot, reference = new Date()) {
  const hour = Number(slot);
  if (![10, 15, 21].includes(hour)) {
    throw new Error("Conversation review slot must be 10, 15 or 21 IST.");
  }

  const today = toIstParts(reference);
  const yesterday = addIstDays(today, -1);

  return {
    slot: hour,
    start: istDateToUtc(yesterday, 21),
    end: istDateToUtc(today, hour),
    finalEnd: istDateToUtc(today, 21),
    batchKey: [
      "conversation-review",
      `${today.year}-${String(today.month + 1).padStart(2, "0")}-${String(today.day).padStart(2, "0")}`,
      "21IST",
    ].join(":"),
  };
}

function requireEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function rowFromItem(item, generatedAt, batchKey) {
  const articleId = conversationArticleId(item.url);

  return {
    title: item.title,
    source: SOURCE_NAME,
    url: item.url,
    summary: item.description || "",
    score: 0,
    status: REVIEW_STATUS,
    created_at: item.publishedAt,
    generated_at: generatedAt,
    generated_error: null,
    relevant: true,
    category: item.edition || null,
    paper: null,
    reason: batchKey,
    keywords: articleId
      ? [`conversation:${articleId}`, `edition:${item.edition || "unknown"}`]
      : [`edition:${item.edition || "unknown"}`],
    evaluated_at: generatedAt,
  };
}

const slot = Number(arg("--slot", ""));
const dryRun = hasFlag("--dry-run");
const referenceArg = arg("--reference", "");
const reference = referenceArg ? new Date(referenceArg) : new Date();

if (Number.isNaN(reference.getTime())) {
  throw new Error("Invalid --reference timestamp.");
}

const window = conversationReviewWindow(slot, reference);
const result = await loadTheConversationReviewWindow({
  windowStart: window.start,
  windowEnd: window.end,
  limit: MAX_ROWS_PER_WINDOW,
});

const publicItems = result.items.filter(isGeneralPublicConversationItem);

console.log(`CONVERSATION_REVIEW_SLOT=${slot}:00 IST`);
console.log(`WINDOW_START=${window.start.toISOString()}`);
console.log(`WINDOW_END=${window.end.toISOString()}`);
console.log(`FINAL_WINDOW_END=${window.finalEnd.toISOString()}`);
console.log(`UNIQUE_IN_WINDOW=${result.stats.uniqueInWindow}`);
console.log(`GENERAL_PUBLIC_ITEMS=${publicItems.length}`);
console.log(
  `FEEDS_HEALTHY=${result.stats.feedsHealthy}/${result.stats.feedsRequested}`
);

for (const feed of result.feedSummary) {
  console.log(
    `${feed.ok ? "OK" : "FAIL"} ${feed.label} fetched=${feed.fetched}` +
      (feed.errors.length ? ` errors=${feed.errors.join(" | ")}` : "")
  );
}

if (dryRun) {
  for (const item of publicItems) {
    console.log(
      `- ${item.publishedAt} | ${item.edition || "unknown"} | ${item.title}`
    );
  }
  process.exit(0);
}

const supabase = createClient(
  requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
  requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

const generatedAt = new Date().toISOString();
const rows = publicItems.map((item) =>
  rowFromItem(item, generatedAt, window.batchKey)
);

const urls = rows.map((row) => row.url).filter(Boolean);
let existingUrls = new Set();

for (let index = 0; index < urls.length; index += 100) {
  const batch = urls.slice(index, index + 100);
  const { data, error } = await supabase
    .from("news_queue")
    .select("url")
    .in("url", batch);

  if (error) {
    throw new Error(`Conversation inbox existing-URL lookup failed: ${error.message}`);
  }

  for (const row of data || []) {
    if (row.url) existingUrls.add(row.url);
  }
}

const newRows = rows.filter((row) => !existingUrls.has(row.url));

if (newRows.length) {
  const { error } = await supabase
    .from("news_queue")
    .insert(newRows);

  if (error) {
    throw new Error(`Conversation inbox insert failed: ${error.message}`);
  }
}

const markerUrl = `internal://conversation-review/${window.batchKey}/slot-${slot}`;
const marker = {
  title: `Conversation review ${slot}:00 IST`,
  source: SOURCE_NAME,
  url: markerUrl,
  summary: JSON.stringify({
    slot,
    windowStart: window.start.toISOString(),
    windowEnd: window.end.toISOString(),
    finalWindowEnd: window.finalEnd.toISOString(),
    feedsHealthy: result.stats.feedsHealthy,
    feedsRequested: result.stats.feedsRequested,
    uniqueInWindow: result.stats.uniqueInWindow,
    generalPublicItems: publicItems.length,
  }),
  score: 0,
  status: MARKER_STATUS,
  created_at: generatedAt,
  generated_at: generatedAt,
  generated_error: result.errors.length ? result.errors.join(" | ").slice(0, 2000) : null,
  relevant: true,
  category: null,
  paper: null,
  reason: window.batchKey,
  keywords: [`slot:${slot}`, `batch:${window.batchKey}`],
  evaluated_at: generatedAt,
};

const { error: markerError } = await supabase
  .from("news_queue")
  .upsert(marker, { onConflict: "url" });

if (markerError) {
  throw new Error(`Conversation review marker write failed: ${markerError.message}`);
}

const cleanupBefore = new Date(
  Date.now() - RETAIN_REVIEW_DAYS * 24 * 60 * 60 * 1000
).toISOString();

const { error: cleanupError } = await supabase
  .from("news_queue")
  .delete()
  .eq("source", SOURCE_NAME)
  .eq("status", REVIEW_STATUS)
  .lt("created_at", cleanupBefore);

if (cleanupError) {
  console.warn(`Conversation review cleanup skipped: ${cleanupError.message}`);
}

console.log(`NEW_METADATA_ROWS=${newRows.length}`);
console.log(`ALREADY_PRESENT=${existingUrls.size}`);
console.log("CONVERSATION_REVIEW_REFRESH=SUCCESS");
