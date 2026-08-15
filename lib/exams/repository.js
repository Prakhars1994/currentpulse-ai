
import { unstable_cache } from "next/cache";
import { createServerSupabase } from "@/lib/supabase-server";

const FIELDS = "id,slug,title,exam_name,agency,source_group,update_type,summary,official_url,source_name,source_published_at,deadline_at,exam_date,status,created_at,updated_at";
const PRIORITY = { UPSC: 10, SSC: 9, Railways: 9, Banking: 8, "State PSC": 8, Defence: 7, "Entrance Exams": 5 };

function cleanError(error) {
  if (!error || error.code === "42P01" || /does not exist/i.test(error.message || "")) return null;
  return error;
}
function time(row) {
  const value = row.source_published_at || row.created_at || row.updated_at;
  const t = value ? new Date(value).getTime() : 0;
  return Number.isFinite(t) ? t : 0;
}
function rank(rows = []) {
  const now = Date.now();
  return [...rows].sort((a,b) => {
    const sa = (PRIORITY[a.source_group] || 5) * 6 - Math.min(Math.max(0,(now-time(a))/3600000),168)/6;
    const sb = (PRIORITY[b.source_group] || 5) * 6 - Math.min(Math.max(0,(now-time(b))/3600000),168)/6;
    return sb-sa || time(b)-time(a);
  });
}

const cachedLatest = unstable_cache(async (type = "", limit = 24) => {
  const supabase = createServerSupabase();
  let query = supabase.from("exam_updates").select(FIELDS).eq("status","published").order("created_at",{ascending:false}).limit(120);
  if (type) query = query.eq("update_type",type);
  const {data,error} = await query;
  return { updates: rank(data || []).slice(0, Math.max(1,Math.min(Number(limit)||24,60))), error: cleanError(error) };
}, ["resultpulse-ranked-v3"], { revalidate: 300, tags:["resultpulse-exams"] });

export async function loadExamUpdates({type="",limit=24}={}) { return cachedLatest(type,limit); }

export const loadExamUpdateBySlug = unstable_cache(async (slug) => {
  const supabase = createServerSupabase();
  const {data,error} = await supabase.from("exam_updates").select("*").eq("slug",slug).eq("status","published").maybeSingle();
  return {update:data||null,error:cleanError(error)};
}, ["resultpulse-detail-v3"], {revalidate:300,tags:["resultpulse-exams"]});

export const loadRelatedExamUpdates = unstable_cache(async (examName,excludeId=0,limit=12) => {
  if (!examName) return {updates:[],error:null};
  const supabase = createServerSupabase();
  let query = supabase.from("exam_updates").select(FIELDS).eq("status","published").eq("exam_name",examName).order("created_at",{ascending:false}).limit(40);
  if (excludeId) query = query.neq("id",excludeId);
  const {data,error} = await query;
  return {updates:rank(data||[]).slice(0,Math.max(1,Math.min(Number(limit)||12,20))),error:cleanError(error)};
}, ["resultpulse-related-v3"], {revalidate:300,tags:["resultpulse-exams"]});
