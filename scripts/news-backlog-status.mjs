import { createClient } from "@supabase/supabase-js";

const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
if (!url || !key) throw new Error("Supabase News backlog credentials are missing.");

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const statuses = ["pending", "processing", "published", "duplicate", "failed", "rejected"];

async function queueCount(status) {
  const { count, error } = await supabase
    .from("article_queue")
    .select("id", { count: "exact", head: true })
    .or("pipeline_kind.eq.news,pipeline_kind.is.null")
    .eq("status", status);
  if (error) throw error;
  return count || 0;
}

const counts = await Promise.all(statuses.map(queueCount));
const { data: newsSources, error: sourceError } = await supabase
  .from("article_sources")
  .select("article_id")
  .eq("source_kind", "news")
  .limit(5000);
if (sourceError) throw sourceError;

const queue = Object.fromEntries(statuses.map((status, index) => [status, counts[index]]));
const publishedArticleIds = new Set((newsSources || []).map((row) => Number(row.article_id)).filter(Boolean));

process.stdout.write(JSON.stringify({
  queue,
  waiting: queue.pending + queue.processing,
  publishedNewsArticles: publishedArticleIds.size,
  sourceRowsScanned: newsSources?.length || 0,
}));