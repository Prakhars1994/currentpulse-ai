import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("homepage is asset-first while dynamic reader routes stay Worker-first", () => {
  const config = read("wrangler.jsonc");
  const workerFirst = config.match(/"run_worker_first"\s*:\s*\[([\s\S]*?)\]/)?.[1] || "";
  assert.doesNotMatch(workerFirst, /^\s*"\/"\s*(?:,|$)/m);
  for (const route of ["/news", "/news/*", "/current-affairs", "/current-affairs/*", "/pdf", "/pdf/*", "/feed.xml"]) {
    assert.match(workerFirst, new RegExp(`"${route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
  }
});

test("reader release has durable retry", () => {
  const workflow = read(".github/workflows/currentpulse-reader-release.yml");
  const request = read("lib/publisher/requestReaderRelease.js");
  assert.match(request, /recordReaderReleaseRequest/);
  assert.match(workflow, /cancel-in-progress: false/);
});

test("production builds static sitemap shards outside the Worker", () => {
  const config = read("wrangler.jsonc");
  const productionWorkflow = read(".github/workflows/currentpulse-production.yml");
  const readerWorkflow = read(".github/workflows/currentpulse-reader-release.yml");
  const generator = read("scripts/build-static-sitemaps.mjs");
  assert.doesNotMatch(config, /"\/sitemap\.xml"/);
  assert.match(productionWorkflow, /build-static-sitemaps\.mjs/);
  assert.match(readerWorkflow, /build-static-sitemaps\.mjs/);
  assert.match(generator, /SHARD_SIZE = 45_000/);
  assert.match(generator, /\.gt\("id", cursor\)/);
  assert.doesNotMatch(generator, /visual_summary,memory_trick,content,seo_description/);
});
