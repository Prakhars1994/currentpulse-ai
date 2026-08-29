import { createClient } from "@supabase/supabase-js";
import { assessQueueFreshness } from "../lib/queue/queueFreshnessPolicy.js";

const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
if (!url || !key) throw new Error("Supabase queue-audit credentials are missing.");

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const totals = new Map();
let offset = 0;
const batchSize = 1000;

while (true) {
  const { data, error } = await supabase
    .from("article_queue")
    .select("id,status,pipeline_kind,published_at,created_at,updated_at")
    .range(offset, offset + batchSize - 1);
  if (error) throw new Error(`Queue audit failed: ${error.message}`);
  for (const row of data || []) {
    const assessment = assessQueueFreshness(row);
    const bucket = `${assessment.lane}:${row.status}:${assessment.reason}`;
    totals.set(bucket, (totals.get(bucket) || 0) + 1);
  }
  if ((data || []).length < batchSize) break;
  offset += batchSize;
}

console.log(JSON.stringify({ auditedRows: [...totals.values()].reduce((a, b) => a + b, 0), buckets: Object.fromEntries([...totals].sort()) }, null, 2));
