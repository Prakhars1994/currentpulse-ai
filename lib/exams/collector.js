import * as cheerio from "cheerio";
import { createHash } from "node:crypto";
import { EXAM_OFFICIAL_SOURCES } from "@/lib/exams/sourceCatalog";
import { enqueueNotificationEvent } from "@/lib/notifications/events";

const UPDATE_PATTERN = /\b(result|results|score\s*card|marks|selected|selection|selection\s+list|merit\s+list|qualified|shortlisted|provisional\s+allotment|admit\s*card|call\s*letter|e-?call\s*letter|city\s+intimation|answer\s*key|response\s*sheet|objection|application|apply\s+online|registration|recruitment|vacanc(?:y|ies)|notification|notice|corrigendum|exam(?:ination)?\s+(?:date|schedule|city)|schedule|reschedul|correction\s+window|last\s+date|deadline|cut[- ]?off|counselling|seat\s+allotment|allocation|interview|document\s+verification|joining\s+letter)\b/i;
const EXCLUDE_PATTERN = /\b(?:privacy policy|terms of use|copyright|contact us|about us|helpdesk|facebook|twitter|instagram|youtube|tender|procurement|annual report)\b/i;

function clean(value = "") {
  return String(value || "").replace(/\s+/g, " ").replace(/\u00a0/g, " ").trim();
}
function absoluteUrl(href, base) {
  try { return new URL(href, base).toString(); } catch { return ""; }
}
function slugify(value = "") {
  return clean(value).toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 170);
}
function fingerprint(sourceId, title, url) {
  return createHash("sha256").update(`${sourceId}|${clean(title).toLowerCase()}|${url}`).digest("hex");
}
function normalizePublishedAt(parsed) {
  if (!(parsed instanceof Date) || Number.isNaN(parsed.getTime())) return null;
  const maxFutureSkewMs = 12 * 60 * 60 * 1000;
  if (parsed.getTime() > Date.now() + maxFutureSkewMs) return null;
  return parsed.toISOString();
}

function parsePublishedAt(text = "") {
  const value = clean(text);
  const monthMatch = value.match(/\b(?:New\s+)?(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2})[,]?\s+(20\d{2})\b/i);
  if (monthMatch) {
    const parsed = new Date(`${monthMatch[1]} ${monthMatch[2]}, ${monthMatch[3]} 12:00:00 +0530`);
    const normalized = normalizePublishedAt(parsed);
    if (normalized) return normalized;
  }
  const numeric = value.match(/\b(\d{1,2})[.\/-](\d{1,2})[.\/-](20\d{2})\b/);
  if (numeric) {
    const parsed = new Date(`${numeric[3]}-${numeric[2].padStart(2,"0")}-${numeric[1].padStart(2,"0")}T12:00:00+05:30`);
    const normalized = normalizePublishedAt(parsed);
    if (normalized) return normalized;
  }
  return null;
}
function classifyType(title = "") {
  const t = clean(title).toLowerCase();
  if (/\b(final\s+result|result|score\s*card|marks|selected|selection list|merit list|qualified|shortlisted|provisional allotment|joining letter)\b/.test(t)) return "result";
  if (
    /\b(?:advance\s+intimation\b[\s\S]{0,90}\bexamination\s+city|city\s+intimation|exam(?:ination)?\s+city)\b/.test(t)
  ) return "exam-date";
  if (/\b(admit\s*card|call\s*letter|e-?call\s*letter)\b/.test(t)) return "admit-card";
  if (/\b(answer\s*key|response\s*sheet|objection|recorded response)\b/.test(t)) return "answer-key";
  if (
    /\b(?:internship|eligibility|qualification|experience|age)\b[\s\S]{0,100}\b(?:cut[- ]?off|cutoff|completion date|last date|deadline)\b/.test(t)
  ) return "deadline";
  if (/\b(last\s+date|deadline|closing date|extension of last date)\b/.test(t)) return "deadline";
  if (/\b(apply\s+online|application|registration|inviting online)\b/.test(t)) return "application";
  if (/\b(cut[- ]?off|cutoff)\b/.test(t)) return "cut-off";
  if (/\b(counselling|seat allotment|allocation)\b/.test(t)) return "counselling";
  if (/\b(exam(?:ination)?\s+(?:date|schedule)|schedule|reschedul|document verification|interview)\b/.test(t)) return "exam-date";
  return "notification";
}
function inferExamName(title, source) {
  const known = clean(title).match(/\b(?:UPSC\s+[A-Z][A-Za-z .()/-]{2,40}\d{4}|SSC\s+[A-Z0-9 -]{2,25}\d{4}|NEET\s*\(?UG\)?[- ]?\d{4}|CUET\s*\(?(?:UG|PG)\)?[- ]?\d{4}|JEE\s*\(?Main\)?[- ]?\d{4}|UGC[- ]?NET\s+[A-Za-z]+\s+\d{4}|CSIR[- ]?UGC\s+NET\s+[A-Za-z]+\s+\d{4}|NCHM\s*JEE\s*\d{4}|NIFTEE\s*[- ]?\d{4}|RRB\s+[A-Z0-9 -]{2,25}|SBI\s+(?:PO|Clerk|JA|CBO)[ -]?\d{4})\b/i);
  return clean(known?.[0] || source.name || source.agency || "Exam update").slice(0, 140);
}
function plausibleTitle(title) {
  const value = clean(title);
  return value.length >= 12 && value.length <= 360 && UPDATE_PATTERN.test(value) && !EXCLUDE_PATTERN.test(value);
}
function rowCandidates($, source) {
  const items = [];
  $("tr").each((_, el) => {
    const row = $(el);
    const text = clean(row.text().replace(/Read More/gi, " "));
    if (!plausibleTitle(text)) return;
    const href = row.find("a[href]").last().attr("href") || row.find("a[href]").first().attr("href");
    const url = absoluteUrl(href, source.url);
    if (!url) return;
    items.push({ title: text.slice(0, 340), url });
  });
  return items;
}
function linkCandidates($, source) {
  const items = [];
  $("a[href]").each((_, el) => {
    const link = $(el);
    let title = clean(link.text());
    const parentText = clean(link.closest("li, article, tr, .notice, .views-row, .list-group-item, .accordion-item, .card").text());
    if ((!plausibleTitle(title) || /^(?:read more|view|download|new)$/i.test(title)) && plausibleTitle(parentText)) title = parentText;
    if (!plausibleTitle(title)) return;
    const url = absoluteUrl(link.attr("href"), source.url);
    if (!url || /javascript:|mailto:|tel:/i.test(url)) return;
    items.push({ title: title.slice(0, 340), url });
  });
  return items;
}
function dedupe(items = []) {
  const out = [];
  const seen = new Set();
  for (const item of items) {
    const key = clean(item.title).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key); out.push(item);
  }
  return out;
}
function sourceStateKey(source) {
  return `exam:${String(source?.id || "unknown")}`;
}

async function loadSourceStates(supabase, sources = []) {
  const keys = sources.map(sourceStateKey);
  if (!keys.length) return new Map();

  const { data, error } = await supabase
    .from("automation_source_state")
    .select("source_key,etag,last_modified,content_hash,initialized_at,last_checked_at,last_changed_at,last_error")
    .in("source_key", keys);

  if (error?.code === "42P01") {
    throw new Error(
      "Low-CPU automation migration is not installed. Run supabase/migrations/20260812_low_cpu_automation.sql before enabling ResultPulse automation."
    );
  }
  if (error) throw error;

  return new Map((data || []).map((row) => [row.source_key, row]));
}

async function saveSourceState(supabase, source, previousState, result, errorMessage = null) {
  const now = new Date().toISOString();
  const changed = Boolean(result && result.changed);
  const payload = {
    source_key: sourceStateKey(source),
    source_kind: "exam",
    source_id: source.id,
    etag: result?.etag || previousState?.etag || null,
    last_modified: result?.lastModified || previousState?.last_modified || null,
    content_hash: result?.contentHash || previousState?.content_hash || null,
    initialized_at: previousState?.initialized_at || (result ? now : null),
    last_checked_at: now,
    last_changed_at: changed ? now : previousState?.last_changed_at || null,
    last_error: errorMessage ? String(errorMessage).slice(0, 1000) : null,
    metadata: {
      httpStatus: result?.httpStatus || null,
      unchanged: Boolean(result?.unchanged),
      fetchedItems: Array.isArray(result?.items) ? result.items.length : 0,
    },
    updated_at: now,
  };

  const { error } = await supabase
    .from("automation_source_state")
    .upsert(payload, { onConflict: "source_key" });
  if (error) {
    console.error(`[ResultPulse] Failed to persist source state for ${source.id}:`, error.message);
  }
}

async function fetchSourceOnce(source, state = null) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 18_000);
  try {
    const headers = {
      "User-Agent": "CurrentPulse-ResultPulse/1.0 (+https://cp.vliab.workers.dev/exams)",
      Accept: "text/html,application/xhtml+xml",
    };
    if (state?.etag) headers["If-None-Match"] = state.etag;
    if (state?.last_modified) headers["If-Modified-Since"] = state.last_modified;

    const response = await fetch(source.url, {
      headers,
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
    });

    if (response.status === 304) {
      return {
        items: [],
        unchanged: true,
        changed: false,
        httpStatus: 304,
        etag: state?.etag || null,
        lastModified: state?.last_modified || null,
        contentHash: state?.content_hash || null,
      };
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const html = await response.text();
    const contentHash = createHash("sha256").update(html).digest("hex");
    const etag = response.headers.get("etag") || state?.etag || null;
    const lastModified = response.headers.get("last-modified") || state?.last_modified || null;

    if (state?.content_hash && state.content_hash === contentHash) {
      return {
        items: [],
        unchanged: true,
        changed: false,
        httpStatus: response.status,
        etag,
        lastModified,
        contentHash,
      };
    }

    const $ = cheerio.load(html);
    const candidates = source.strategy === "rows"
      ? rowCandidates($, source)
      : linkCandidates($, source);
    const perSourceLimit = Math.max(
      20,
      Math.min(80, Number(process.env.EXAM_ITEMS_PER_SOURCE) || 50)
    );

    return {
      items: dedupe(candidates).slice(0, perSourceLimit),
      unchanged: false,
      changed: true,
      httpStatus: response.status,
      etag,
      lastModified,
      contentHash,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchSource(source, state = null) {
  const urls = [source.url, ...(source.fallbackUrls || [])];
  const errors = [];
  for (const url of urls) {
    try {
      const result = await fetchSourceOnce({ ...source, url }, state);
      if (result.unchanged || result.items.length || url === urls[urls.length - 1]) return result;
    } catch (error) {
      errors.push(`${url}: ${error?.message || error}`);
    }
  }
  throw new Error(errors.join("; ") || "All official source URLs failed.");
}

async function loadExistingFingerprints(supabase, fingerprints = []) {
  const existing = new Set();
  const unique = [...new Set(fingerprints.filter(Boolean))];
  for (let index = 0; index < unique.length; index += 100) {
    const batch = unique.slice(index, index + 100);
    const { data, error } = await supabase
      .from("exam_updates")
      .select("fingerprint")
      .in("fingerprint", batch);
    if (error) throw error;
    for (const row of data || []) existing.add(row.fingerprint);
  }
  return existing;
}

async function insertExamUpdates(supabase, rows = []) {
  const inserted = [];
  const failures = [];
  for (let index = 0; index < rows.length; index += 100) {
    const batch = rows.slice(index, index + 100);
    const { data, error } = await supabase
      .from("exam_updates")
      .upsert(batch, { onConflict: "fingerprint", ignoreDuplicates: true })
      .select("id,fingerprint,slug,title,update_type");
    if (error) {
      failures.push(...batch.map((row) => ({ title: row.title, error: error.message })));
      continue;
    }
    inserted.push(...(data || []));
  }
  return { inserted, failures };
}

export async function collectOfficialExamUpdates(
  supabase,
  { sources = EXAM_OFFICIAL_SOURCES } = {}
) {
  const selectedSources = Array.isArray(sources) && sources.length
    ? sources
    : EXAM_OFFICIAL_SOURCES;

  const { data: existingSample, error: countError } = await supabase
    .from("exam_updates")
    .select("id,source_name")
    .limit(1000);
  if (countError?.code === "42P01") {
    throw new Error(
      "ResultPulse database migration is not installed. Run supabase/migrations/20260811100000_resultpulse_notifications.sql first."
    );
  }
  if (countError) throw countError;

  const sourceStates = await loadSourceStates(supabase, selectedSources);
  const populatedSources = new Set((existingSample || []).map((row) => row.source_name).filter(Boolean));
  const sourceResults = await Promise.all(
    selectedSources.map(async (source) => {
      const key = sourceStateKey(source);
      // A cached 304 must never permanently preserve an empty source. When a
      // source has no retained rows, omit validators once to bootstrap it.
      const previousState = populatedSources.has(source.name) ? (sourceStates.get(key) || null) : null;
      const initializedBefore = Boolean(previousState?.initialized_at);
      try {
        const fetched = await fetchSource(source, previousState);
        await saveSourceState(supabase, source, previousState, fetched);
        return {
          source,
          items: fetched.items,
          error: null,
          unchanged: fetched.unchanged,
          httpStatus: fetched.httpStatus,
          initializedBefore,
        };
      } catch (error) {
        const message = String(error?.message || error);
        await saveSourceState(supabase, source, previousState, null, message);
        return {
          source,
          items: [],
          error: message,
          unchanged: false,
          httpStatus: null,
          initializedBefore,
        };
      }
    })
  );

  const prepared = [];
  const preparedMeta = new Map();
  for (const sourceResult of sourceResults) {
    for (const item of sourceResult.items) {
      const updateType = classifyType(item.title);
      const fp = fingerprint(sourceResult.source.id, item.title, item.url);
      const baseSlug = slugify(`${sourceResult.source.name}-${item.title}`) || `exam-update-${fp.slice(0, 16)}`;
      const payload = {
        fingerprint: fp,
        slug: `${baseSlug.slice(0, 155)}-${fp.slice(0, 8)}`,
        title: item.title,
        exam_name: inferExamName(item.title, sourceResult.source),
        agency: sourceResult.source.agency,
        source_group: sourceResult.source.group || null,
        update_type: updateType,
        summary: `Official ${updateType.replace(/-/g, " ")} update from ${sourceResult.source.name}. Open the official source to apply, download, or verify details.`,
        official_url: item.url,
        source_name: sourceResult.source.name,
        source_url: sourceResult.source.url,
        source_published_at: parsePublishedAt(item.title),
        status: "published",
        updated_at: new Date().toISOString(),
      };
      prepared.push(payload);
      preparedMeta.set(fp, {
        sourceId: sourceResult.source.id,
        sourceName: sourceResult.source.name,
        notifyEligible: sourceResult.initializedBefore,
      });
    }
  }

  const discovered = prepared.length;
  const existingFingerprints = await loadExistingFingerprints(
    supabase,
    prepared.map((row) => row.fingerprint)
  );
  const unseenRows = prepared.filter((row) => !existingFingerprints.has(row.fingerprint));
  const saved = unseenRows.length
    ? await insertExamUpdates(supabase, unseenRows)
    : { inserted: [], failures: [] };
  const insertedRows = saved.inserted;
  const insertedFingerprints = new Set(insertedRows.map((row) => row.fingerprint));
  const concurrentDuplicates = unseenRows.filter(
    (row) =>
      !insertedFingerprints.has(row.fingerprint) &&
      !saved.failures.some((failure) => failure.title === row.title)
  ).length;
  const existing = existingFingerprints.size + concurrentDuplicates;
  const failed = saved.failures.length;

  const notificationCandidates = insertedRows.filter(
    (row) => preparedMeta.get(row.fingerprint)?.notifyEligible
  );
  if (notificationCandidates.length) {
    await Promise.allSettled(
      notificationCandidates.map((data) => {
        const payload = prepared.find((row) => row.fingerprint === data.fingerprint);
        return enqueueNotificationEvent(supabase, {
          entityKey: `exam:${data.fingerprint}`,
          topic: `exam_${data.update_type.replace(/-/g, "_")}`,
          title: data.title,
          summary: payload?.summary || "Official exam update.",
          url: `/exams/${data.slug}`,
        });
      })
    );
  }

  const results = [
    ...insertedRows.map((data) => ({
      status: "inserted",
      title: data.title,
      type: data.update_type,
      source: preparedMeta.get(data.fingerprint)?.sourceName || null,
      notificationQueued: Boolean(preparedMeta.get(data.fingerprint)?.notifyEligible),
    })),
    ...saved.failures.map((failure) => ({ status: "failed", ...failure })),
  ];

  const bootstrapSources = sourceResults
    .filter((result) => !result.initializedBefore && !result.error)
    .map((result) => result.source.id);
  const unchangedSources = sourceResults
    .filter((result) => result.unchanged)
    .map((result) => result.source.id);

  return {
    success: true,
    selectedSourceIds: selectedSources.map((source) => source.id),
    sources: sourceResults.map(({ source, items, error, unchanged, httpStatus, initializedBefore }) => ({
      id: source.id,
      name: source.name,
      fetched: items.length,
      unchanged,
      httpStatus,
      initializedBefore,
      error,
    })),
    bootstrap: bootstrapSources.length > 0,
    bootstrapSources,
    unchangedSources,
    discovered,
    inserted: insertedRows.length,
    existing,
    failed,
    notificationEventsQueued: notificationCandidates.length,
    databaseRoundTripsEstimate:
      1 +
      Math.ceil(prepared.length / 100) +
      Math.ceil(unseenRows.length / 100),
    results: results.slice(0, 80),
  };
}
