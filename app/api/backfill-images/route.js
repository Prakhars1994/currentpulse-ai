import { after, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { requireAuthenticatedAdmin } from "@/lib/adminAuth";
import { isVerifiedReusableArticleImage } from "@/lib/news/categoryImage";
import { isTerminalImageResolution, resolveGovernmentArticleImage } from "@/lib/news/governmentImageResolver";
import { isPublishedArticleSafe } from "@/lib/editorial/publicationSafety";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
const CONCURRENCY = 1;
const DEFAULT_LIMIT = 3;
const MAX_LIMIT = 5;
const SCAN_LIMIT = 80;
async function isAuthorised(request){const secret=process.env.CRON_SECRET?.trim()||"";if(Boolean(secret)&&request.headers.get("authorization")?.trim()===`Bearer ${secret}`)return true;try{const auth=await requireAuthenticatedAdmin(request);return Boolean(auth?.ok);}catch{return false;}}
async function mapWithConcurrency(items,handler){const results=new Array(items.length);let index=0;async function worker(){while(index<items.length){const current=index++;results[current]=await handler(items[current]);}}await Promise.all(Array.from({length:Math.min(CONCURRENCY,items.length)},()=>worker()));return results;}
function hasFlag(article,flag){return Array.isArray(article.quality_flags)&&article.quality_flags.includes(flag);}
async function executeBackfill(limit,targetStream="news"){
  const startedAt=Date.now();const supabase=createServerSupabase();
  const{data,error}=await supabase.from("articles").select("id,title,slug,category,why_news,content,static_foundation,quality_flags,image,image_url,image_source_url,image_caption,image_search_query,image_resolution,created_at,article_sources(source_kind,source_url,source_name)").eq("status","published").order("created_at",{ascending:false}).limit(SCAN_LIMIT);if(error)throw new Error(`Image backfill fetch failed: ${error.message}`);
  const needsReplacement=(article)=>{const stream=(article.article_sources||[]).some((source)=>source?.source_kind==="coaching")?"coverage":"news";const adminPdfNews=hasFlag(article,"news_pdf_import")||(article.article_sources||[]).some((source)=>source?.source_name==="CurrentPulse Admin News PDF");const safeForImage=stream==="news"?adminPdfNews:isPublishedArticleSafe(article,{stream});return stream===targetStream&&safeForImage&&!isVerifiedReusableArticleImage(article)&&!isTerminalImageResolution(article.image_resolution);};
  const missing=(data||[]).filter(needsReplacement).slice(0,limit);
  const results=await mapWithConcurrency(missing,async(article)=>{try{const deadlineAt=Date.now()+10000;const resolved=await resolveGovernmentArticleImage(article,{deadlineAt});const patch={image_resolution:resolved.resolution,image_search_query:resolved.query||resolved.resolution?.search_query||article.image_search_query||article.title,updated_at:new Date().toISOString()};if(resolved.image)Object.assign(patch,{image:resolved.image.url,image_url:resolved.image.url,image_alt:resolved.image.alt||article.title,image_caption:resolved.image.attribution||null,image_source_url:resolved.image.sourcePageUrl||null});const{error:updateError}=await supabase.from("articles").update(patch).eq("id",article.id);if(updateError)throw new Error(updateError.message);return{status:resolved.image?"updated":"no_safe_image",articleId:article.id,title:article.title,provider:resolved.resolution?.provider||null,requestsUsed:resolved.resolution?.requests_used||0,storage:resolved.image?"hotlink":"none",query:resolved.query||null};}catch(backfillError){console.error(`[Image backfill] Failed for ${article.id}:`,backfillError?.message||backfillError);return{status:"failed",articleId:article.id,title:article.title,error:backfillError?.message||"Image backfill failed"};}});
  return NextResponse.json({success:true,policy:"resolve-once-persist-once-wikimedia-first",stream:targetStream,stats:{scanned:(data||[]).length,selected:missing.length,updated:results.filter((item)=>item.status==="updated").length,noSafeImage:results.filter((item)=>item.status==="no_safe_image").length,failed:results.filter((item)=>item.status==="failed").length,concurrency:CONCURRENCY,durationMs:Date.now()-startedAt},results});
}
export async function GET(request){if(!(await isAuthorised(request)))return NextResponse.json({success:false,message:"Unauthorised image backfill request."},{status:401});const url=new URL(request.url);const requestedLimit=Number.parseInt(url.searchParams.get("limit")||"",10);const limit=Number.isFinite(requestedLimit)?Math.min(MAX_LIMIT,Math.max(1,requestedLimit)):DEFAULT_LIMIT;const targetStream=url.searchParams.get("stream")==="coverage"?"coverage":"news";if(url.searchParams.get("wait")==="1")return executeBackfill(limit,targetStream);after(async()=>{try{await executeBackfill(limit,targetStream);}catch(error){console.error("[Image backfill] Background run failed:",error?.message||error);}});return NextResponse.json({success:true,accepted:true,message:`Optional ${targetStream} image enrichment accepted for up to ${limit} articles.`},{status:202});}
