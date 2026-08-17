import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("reader traffic no longer writes article views directly to Supabase", () => {
  const source = read("components/ArticleViewTracker.jsx");
  assert.doesNotMatch(source, /@\/lib\/supabase/);
  assert.doesNotMatch(source, /increment_article_views/);
  assert.doesNotMatch(source, /\.rpc\s*\(/);
});

test("Cloudflare serves static reader assets before Worker SSR", () => {
  const config = read("wrangler.jsonc");
  assert.match(config, /"html_handling"\s*:\s*"drop-trailing-slash"/);
  assert.match(config, /"run_worker_first"\s*:\s*\[[\s\S]*"\/api\/\*"[\s\S]*"\/admin\/\*"/);
  assert.doesNotMatch(config, /"run_worker_first"\s*:\s*true/);
});

test("static reader materializer blocks Next RSC prefetch and emits an asset manifest", () => {
  const source = read("scripts/materialize-static-reader.mjs");
  assert.match(source, /currentpulse-static-reader/);
  assert.match(source, /_rsc/);
  assert.match(source, /Next-Router-Prefetch/);
  assert.match(source, /currentpulse-static-reader-manifest\.json/);
  assert.match(source, /reuse-base/);
  assert.match(source, /reusedArchivePages/);
  assert.match(source, /materializeStaticFiles/);
  assert.match(source, /requiredStaticFailures/);
  assert.match(source, /name=\["'\]currentpulse-static-reader/);
});

test("trusted Current Affairs quality floor is materially higher than the old permissive threshold", () => {
  const generator = read("lib/ai/generateArticle.js");
  const publisher = read("lib/publisher/publishArticle.js");
  assert.match(generator, /score\s*\|\|\s*0\)\s*>=\s*72/);
  assert.match(publisher, /fallbackQuality\s*<\s*80/);
});

test("GitHub is the single scheduled heavy automation owner", () => {
  const background = read(".github/workflows/currentpulse-background.yml");
  const maintenance = read(".github/workflows/currentpulse-quality-maintenance.yml");
  assert.match(background, /schedule:/);
  assert.match(background, /0 1,4,7,10,14,17,18 \* \* \*/);
  assert.doesNotMatch(maintenance, /\n\s+schedule:/);
});
