import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const fingerprintOnly = process.argv.includes("--fingerprint-only");
const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

if (!url || !key) {
  throw new Error("Supabase release-state credentials are missing.");
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function latest(table, fields, orderColumn = "updated_at") {
  const { data, error } = await supabase
    .from(table)
    .select(fields)
    .order(orderColumn, { ascending: false, nullsFirst: false })
    .limit(1);
  if (error) throw new Error(`${table} release-state query failed: ${error.message}`);
  return data?.[0] || null;
}

const [article, source, exam, quiz] = await Promise.all([
  latest("articles", "id,status,updated_at"),
  latest("article_sources", "article_id,source_kind,updated_at,created_at"),
  latest("exam_updates", "id,status,updated_at"),
  latest("quiz_questions", "id,quiz_date,updated_at"),
]);

const state = { article, source, exam, quiz };
const fingerprint = createHash("sha256")
  .update(JSON.stringify(state))
  .digest("hex");

if (fingerprintOnly) {
  process.stdout.write(fingerprint);
} else {
  process.stdout.write(JSON.stringify({ fingerprint, state }));
}