import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("reader traffic no longer writes article views directly to Supabase", () => {
  const source = read("components/ArticleViewTracker.jsx");
  assert.doesNotMatch(source, /@\/lib\/supabase|increment_article_views|\.rpc\s*\(/);
});

test("Cloudflare keeps dynamic reader paths Worker-first but homepage asset-first", () => {
  const config = read("wrangler.jsonc");
  assert.match(config, /"run_worker_first"\s*:\s*\[[\s\S]*"\/api\/\*"[\s\S]*"\/admin\/\*"/);
  assert.match(config, /"\/news\/\*"/);
  assert.match(config, /"\/current-affairs\/\*"/);
  const workerFirst = config.match(/"run_worker_first"\s*:\s*\[([\s\S]*?)\]/)?.[1] || "";
  assert.doesNotMatch(workerFirst, /^\s*"\/"\s*(?:,|$)/m);
});

test("static reader materializer retains incremental release safeguards", () => {
  const source = read("scripts/materialize-static-reader.mjs");
  assert.match(source, /currentpulse-static-reader-manifest\.json/);
  assert.match(source, /reuse-local/);
  assert.match(source, /addRecentlyChangedDatabasePaths/);
  assert.match(source, /pruneWorkerFirstDynamicAssets/);
});

test("GitHub scheduled background is ResultPulse-only", () => {
  const background = read(".github/workflows/currentpulse-background.yml");
  for (const utcHour of [1, 7, 14, 17]) assert.match(background, new RegExp(`0 ${utcHour} \\* \\* \\*`));
  for (const removedHour of [4, 10, 18]) assert.doesNotMatch(background, new RegExp(`0 ${removedHour} \\* \\* \\*`));
  assert.match(background, /\/api\/exams\/run/);
});
