import { createServerSupabase } from "@/lib/supabase-server";
import { getExamSourceFilter, normalizeExamFilters } from "@/lib/exams/filters";

const FIELDS = "id,slug,title,exam_name,agency,source_group,update_type,summary,official_url,source_name,source_published_at,deadline_at,exam_date,status,created_at,updated_at";
const PRIORITY = { UPSC: 10, SSC: 9, Railways: 9, Banking: 8, "State PSC": 8, Defence: 7, "Entrance Exams": 5 };
const CACHE_TTL_MS = 120_000;
const cache = globalThis.__currentPulseExamRepositoryCache || new Map();
globalThis.__currentPulseExamRepositoryCache = cache;

function cleanError(error) {
  if (!error || error.code === "42P01" || /does not exist/i.test(error.message || "")) return null;
  return error instanceof Error ? error : new Error(error.message || String(error));
}

function normalizeTitle(value = "") {
  let text = String(value || "").replace(/\s+/g, " ").trim();
  text = text
    .replace(/^\d(?=\d{1,2}\/\d{1,2}\/20\d{2})/, "")
    .replace(/^\d{1,2}\/\d{1,2}\/20\d{2}\s*/i, "")
    .replace(/^\d{1,3}[.)-]\s*/, "")
    .replace(/\b(?:click here|read more|new update)\s*$/i, "")
    .replace(/([a-z])([A-Z]{2,})/g, "$1 $2");
  return text.trim();
}

function normalizeRow(row = {}) {
  return {
    ...row,
    title: normalizeTitle(row.title) || row.exam_name || "Official exam update",
    summary: String(row.summary || "").replace(/\s+/g, " ").trim(),
  };
}

function rowTime(row) {
  const value = row.source_published_at || row.created_at || row.updated_at;
  const timestamp = value ? new Date(value).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function rank(rows = []) {
  const now = Date.now();
  return rows.map(normalizeRow).sort((a, b) => {
    const scoreA = (PRIORITY[a.source_group] || 5) * 6 - Math.min(Math.max(0, (now - rowTime(a)) / 3600000), 168) / 6;
    const scoreB = (PRIORITY[b.source_group] || 5) * 6 - Math.min(Math.max(0, (now - rowTime(b)) / 3600000), 168) / 6;
    return scoreB - scoreA || rowTime(b) - rowTime(a);
  });
}

async function ttlCached(key, loader, ttlMs = CACHE_TTL_MS) {
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) return cached.value;

  const value = await loader();
  cache.set(key, { value, expiresAt: now + ttlMs });
  if (cache.size > 80) {
    for (const [cacheKey, entry] of cache) {
      if (entry.expiresAt <= now) cache.delete(cacheKey);
    }
  }
  return value;
}

async function safeQuery(loader, emptyValue = { updates: [], error: null }) {
  try {
    return await loader();
  } catch (error) {
    console.error("ResultPulse repository query failed:", error?.message || error);
    return { ...emptyValue, error: cleanError(error) };
  }
}

export async function loadExamUpdates({ type = "", group = "", source = "", q = "", limit = 24, offset = 0 } = {}) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 24, 60));
  const safeOffset = Math.max(0, Number(offset) || 0);
  const active = normalizeExamFilters({ type, group, source, q });
  const sourceFilter = getExamSourceFilter(active.source);
  const cacheKey = `archive:${active.type}:${active.group}:${active.source}:${active.q}:${safeLimit}:${safeOffset}`;

  return ttlCached(cacheKey, () => safeQuery(async () => {
    const supabase = createServerSupabase();
    let query = supabase
      .from("exam_updates")
      .select(FIELDS)
      .eq("status", "published")
      .order("created_at", { ascending: false });

    if (active.type) query = query.eq("update_type", active.type);
    if (active.group) query = query.eq("source_group", active.group);
    if (sourceFilter) query = query.eq("source_name", sourceFilter.label);
    if (active.q) query = query.or(`exam_name.ilike.%${active.q}%,title.ilike.%${active.q}%`);

    // Fetch one extra row so the archive can remain complete and pagewise
    // without an expensive COUNT(*) on every public request.
    const { data, error } = await query.range(safeOffset, safeOffset + safeLimit);
    const rows = data || [];
    return {
      updates: rank(rows.slice(0, safeLimit)),
      hasMore: rows.length > safeLimit,
      error: cleanError(error),
    };
  }));
}

export async function loadExamUpdateBySlug(slug) {
  if (!slug) return { update: null, error: null };
  return ttlCached(`slug:${slug}`, () => safeQuery(async () => {
    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("exam_updates")
      .select("*")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();
    return { update: data ? normalizeRow(data) : null, error: cleanError(error) };
  }, { update: null, error: null }));
}

export async function loadRelatedExamUpdates(examName, excludeId = 0, limit = 12) {
  if (!examName) return { updates: [], error: null };
  const safeLimit = Math.max(1, Math.min(Number(limit) || 12, 20));
  return ttlCached(`related:${examName}:${excludeId}:${safeLimit}`, () => safeQuery(async () => {
    const supabase = createServerSupabase();
    let query = supabase
      .from("exam_updates")
      .select(FIELDS)
      .eq("status", "published")
      .eq("exam_name", examName)
      .order("created_at", { ascending: false })
      .limit(40);
    if (excludeId) query = query.neq("id", excludeId);
    const { data, error } = await query;
    return { updates: rank(data || []).slice(0, safeLimit), error: cleanError(error) };
  }));
}
