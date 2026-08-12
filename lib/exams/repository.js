import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabase";

const EXAM_CARD_FIELDS = "id,slug,title,exam_name,agency,source_group,update_type,summary,official_url,source_name,source_published_at,deadline_at,exam_date,status,created_at,updated_at";

function cleanError(error) {
  if (!error) return null;
  if (error.code === "42P01" || /does not exist/i.test(error.message || "")) return null;
  return error;
}

const cachedLatestExamUpdates = unstable_cache(
  async (type = "", limit = 24) => {
    let query = supabase
      .from("exam_updates")
      .select(EXAM_CARD_FIELDS)
      .eq("status", "published")
      .order("source_published_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(Math.max(1, Math.min(Number(limit) || 24, 60)));
    if (type) query = query.eq("update_type", type);
    const { data, error } = await query;
    return { updates: data || [], error: cleanError(error) };
  },
  ["resultpulse-latest-updates-v1"],
  { revalidate: 60, tags: ["resultpulse-exams"] }
);

export async function loadExamUpdates({ type = "", limit = 24 } = {}) {
  return cachedLatestExamUpdates(type, limit);
}

export const loadExamUpdateBySlug = unstable_cache(
  async (slug) => {
    const { data, error } = await supabase
      .from("exam_updates")
      .select("*")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();
    return { update: data || null, error: cleanError(error) };
  },
  ["resultpulse-exam-detail-v1"],
  { revalidate: 120, tags: ["resultpulse-exams"] }
);


export const loadRelatedExamUpdates = unstable_cache(
  async (examName, excludeId = 0, limit = 12) => {
    if (!examName) return { updates: [], error: null };
    let query = supabase
      .from("exam_updates")
      .select(EXAM_CARD_FIELDS)
      .eq("status", "published")
      .eq("exam_name", examName)
      .order("source_published_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(Math.max(1, Math.min(Number(limit) || 12, 20)));
    if (excludeId) query = query.neq("id", excludeId);
    const { data, error } = await query;
    return { updates: data || [], error: cleanError(error) };
  },
  ["resultpulse-related-updates-v1"],
  { revalidate: 120, tags: ["resultpulse-exams"] }
);
