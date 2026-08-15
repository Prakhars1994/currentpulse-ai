
import { createServerSupabase } from "@/lib/supabase-server";
const cache = globalThis.__currentPulseHomepageStatsCache || {expiresAt:0,value:null};
globalThis.__currentPulseHomepageStatsCache = cache;

function indiaDayRange() {
  const day = new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const start = new Date(`${day}T00:00:00+05:30`); const end = new Date(start); end.setDate(end.getDate()+1);
  return {day,start:start.toISOString(),end:end.toISOString()};
}
async function count(query) { const {count,error}=await query; return {count:count||0,error}; }

export async function loadHomepageStats() {
  if (cache.value && cache.expiresAt>Date.now()) return cache.value;
  const supabase=createServerSupabase(); const range=indiaDayRange();
  const [today,latest,totalCA,totalNews]=await Promise.all([
    supabase.from("articles").select("id,created_at").eq("status","published").gte("created_at",range.start).lt("created_at",range.end).limit(500),
    supabase.from("articles").select("created_at,updated_at").eq("status","published").order("updated_at",{ascending:false}).limit(1).maybeSingle(),
    count(supabase.from("articles").select("id,article_sources!inner(source_kind)",{count:"exact",head:true}).eq("status","published").eq("article_sources.source_kind","coaching")),
    count(supabase.from("articles").select("id,article_sources!inner(source_kind)",{count:"exact",head:true}).eq("status","published").eq("article_sources.source_kind","news")),
  ]);
  let todayCurrentAffairs=0,todayNews=0; const errors=[];
  if (today.error) errors.push(today.error.message);
  else {
    const ids=(today.data||[]).map(r=>r.id);
    if (ids.length) {
      const sources=await supabase.from("article_sources").select("article_id,source_kind").in("article_id",ids);
      if (sources.error) errors.push(sources.error.message);
      else {
        const ca=new Set(),news=new Set();
        for (const s of sources.data||[]) { if(s.source_kind==="coaching") ca.add(s.article_id); if(s.source_kind==="news") news.add(s.article_id); }
        todayCurrentAffairs=ca.size; todayNews=news.size;
      }
    }
  }
  for (const r of [latest,totalCA,totalNews]) if(r.error) errors.push(r.error.message);
  const value={todayCurrentAffairs,todayNews,totalCurrentAffairs:totalCA.count,totalNews:totalNews.count,lastUpdated:latest.data?.updated_at||latest.data?.created_at||null,date:range.day,error:errors.length?errors.join("; "):null};
  cache.value=value; cache.expiresAt=Date.now()+120000; return value;
}
