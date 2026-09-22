import { createServerSupabase } from "@/lib/supabase-server";
import { getExamSourceFilter, normalizeExamFilters } from "@/lib/exams/filters";
import { examDisplayTitle, hasFutureLeadingExamListingDate, normalizeExamEventTitle } from "@/lib/sitemapQuality";

const FIELDS = "id,slug,title,exam_name,agency,source_group,update_type,summary,official_url,source_name,source_published_at,deadline_at,exam_date,status,created_at,updated_at";
const PRIORITY = { UPSC: 10, SSC: 9, Railways: 9, Banking: 8, "State PSC": 8, Defence: 7, "Entrance Exams": 5 };
const CACHE_TTL_MS = 120_000;
const BALANCED_CACHE_TTL_MS = 120_000;
const cache = globalThis.__currentPulseExamRepositoryCache || new Map();
globalThis.__currentPulseExamRepositoryCache = cache;

function cleanError(error) {
  if (!error) return null;
  return error instanceof Error ? error : new Error(error.message || String(error));
}
function normalizeTitle(value = "") {
  let text = String(value || "").replace(/\s+/g, " ").trim();
  text = text.replace(/^\d(?=\d{1,2}\/\d{1,2}\/20\d{2})/, "").replace(/^\d{1,2}\/\d{1,2}\/20\d{2}\s*/i, "").replace(/^\d{1,3}[.)-]?\s*(?=[A-Za-z])/, "").replace(/\b(?:click here|read more|new update)\s*$/i, "").replace(/([a-z])([A-Z]{2,})/g, "$1 $2");
  return text.trim();
}
function normalizeRow(row = {}) {
  const title = examDisplayTitle(normalizeTitle(row.title)) || row.exam_name || "Official exam update";
  return { ...row, title, summary: String(row.summary || "").replace(/\s+/g, " ").trim() };
}
function hasValidOfficialUrl(value = "") { try { const url = new URL(String(value || "")); return url.protocol === "https:" || url.protocol === "http:"; } catch { return false; } }
function readerRows(rows = []) {
  const included=[]; const seen=new Set();
  for (const raw of rows) { const row=normalizeRow(raw); const titleKey=normalizeExamEventTitle(row.title); if(!row.slug||titleKey.length<8||!hasValidOfficialUrl(row.official_url))continue; if(hasFutureLeadingExamListingDate(raw.title))continue; const key=`${String(row.source_name||row.agency||"").toLowerCase()}|${row.update_type||""}|${titleKey}|${row.official_url||""}`; if(seen.has(key))continue; seen.add(key); included.push(row); }
  return included;
}
function rowTime(row) { const value=row.source_published_at||row.created_at; const timestamp=value?new Date(value).getTime():0; return Number.isFinite(timestamp)?timestamp:0; }
function rank(rows=[]) { const now=Date.now(); return rows.map(normalizeRow).sort((a,b)=>{ const timeA=rowTime(a),timeB=rowTime(b); const scoreA=(PRIORITY[a.source_group]||5)*6-(timeA?Math.min(Math.max(0,(now-timeA)/3600000),168)/6:28); const scoreB=(PRIORITY[b.source_group]||5)*6-(timeB?Math.min(Math.max(0,(now-timeB)/3600000),168)/6:28); return scoreB-scoreA||timeB-timeA; }); }
async function ttlCached(key,loader,ttlMs=CACHE_TTL_MS){const now=Date.now(),cached=cache.get(key);if(cached&&cached.expiresAt>now)return cached.value;const value=await loader();if(!value?.error)cache.set(key,{value,expiresAt:now+ttlMs});if(cache.size>80)for(const[k,e]of cache)if(e.expiresAt<=now)cache.delete(k);return value;}
async function safeQuery(loader,emptyValue={updates:[],error:null}){try{return await loader();}catch(error){console.error("ResultPulse repository query failed:",error?.message||error);return{...emptyValue,error:cleanError(error)};}}

// Front page deliberately reads across every published authority. The previous
// hard-coded source allow-list hid newly backfilled UPSC/SSC/IBPS/BPSC/Railway
// records even though they existed in production.
async function loadBalancedFrontPage(limit){
  return ttlCached(`balanced-front-v3:${limit}`,()=>safeQuery(async()=>{
    const supabase=createServerSupabase();
    const {data,error}=await supabase.from("exam_updates").select(FIELDS).eq("status","published").order("created_at",{ascending:false}).limit(240);
    if(error)throw error;
    const eligible=readerRows(data||[]);
    const buckets=new Map();
    for(const row of rank(eligible)){const key=row.source_name||row.agency||"Other";if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(row);}
    const picked=[]; const seen=new Set();
    // First guarantee breadth: up to two strong recent items per authority.
    for(let round=0;round<2&&picked.length<limit;round++)for(const rows of buckets.values()){const row=rows[round];if(row&&!seen.has(row.id)){seen.add(row.id);picked.push(row);if(picked.length>=limit)break;}}
    // Then fill by priority/freshness across the entire candidate set.
    for(const row of rank(eligible)){if(picked.length>=limit)break;if(!seen.has(row.id)){seen.add(row.id);picked.push(row);}}
    return {updates:rank(picked).slice(0,limit),hasMore:eligible.length>limit,error:null};
  }),BALANCED_CACHE_TTL_MS);
}

export async function loadExamUpdates({type="",group="",source="",q="",limit=24,offset=0}={}){
  const safeLimit=Math.max(1,Math.min(Number(limit)||24,60)); const safeOffset=Math.max(0,Number(offset)||0); const active=normalizeExamFilters({type,group,source,q}); const sourceFilter=getExamSourceFilter(active.source);
  if(!active.type&&!active.group&&!active.source&&!active.q&&safeOffset===0)return loadBalancedFrontPage(safeLimit);
  const cacheKey=`archive-v3:${active.type}:${active.group}:${active.source}:${active.q}:${safeLimit}:${safeOffset}`;
  return ttlCached(cacheKey,()=>safeQuery(async()=>{const supabase=createServerSupabase();let query=supabase.from("exam_updates").select(FIELDS).eq("status","published").order("source_published_at",{ascending:false,nullsFirst:false}).order("created_at",{ascending:false});if(active.type)query=query.eq("update_type",active.type);if(active.group)query=query.eq("source_group",active.group);if(sourceFilter)query=query.eq("source_name",sourceFilter.label);if(active.q)query=query.or(`exam_name.ilike.%${active.q}%,title.ilike.%${active.q}%`);const{data,error}=await query.range(safeOffset,safeOffset+safeLimit);const rows=data||[];return{updates:rank(readerRows(rows.slice(0,safeLimit))),hasMore:rows.length>safeLimit,error:cleanError(error)};}));
}
export async function loadExamUpdateBySlug(slug){if(!slug)return{update:null,error:null};return ttlCached(`slug-v3:${slug}`,()=>safeQuery(async()=>{const supabase=createServerSupabase();const{data,error}=await supabase.from("exam_updates").select("*").eq("slug",slug).eq("status","published").maybeSingle();return{update:data?normalizeRow(data):null,error:cleanError(error)};},{update:null,error:null}));}
export async function loadRelatedExamUpdates(examName,excludeId=0,limit=12){if(!examName)return{updates:[],error:null};const safeLimit=Math.max(1,Math.min(Number(limit)||12,20));return ttlCached(`related-v3:${examName}:${excludeId}:${safeLimit}`,()=>safeQuery(async()=>{const supabase=createServerSupabase();let query=supabase.from("exam_updates").select(FIELDS).eq("status","published").eq("exam_name",examName).order("source_published_at",{ascending:false,nullsFirst:false}).order("created_at",{ascending:false}).limit(40);if(excludeId)query=query.neq("id",excludeId);const{data,error}=await query;return{updates:rank(readerRows(data||[])).slice(0,safeLimit),error:cleanError(error)};}));}
