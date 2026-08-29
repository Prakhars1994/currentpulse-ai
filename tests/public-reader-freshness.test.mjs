import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { assessQueueFreshness } from "../lib/queue/queueFreshnessPolicy.js";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("freshness-critical public routes bypass asset-first routing", () => {
  const config = read("wrangler.jsonc");
  for (const route of ["/", "/news", "/news/*", "/current-affairs", "/current-affairs/*", "/pdf", "/pdf/*", "/sitemap.xml", "/feed.xml"]) {
    assert.match(config, new RegExp(`"${route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`));
  }
});

test("reader release has a durable outbox and non-cancelling automatic retry", () => {
  const migration = read("supabase/migrations/20260829133955_durable_reader_release_outbox.sql");
  const workflow = read(".github/workflows/currentpulse-reader-release.yml");
  const request = read("lib/publisher/requestReaderRelease.js");
  assert.match(migration, /create table if not exists public\.reader_release_requests/);
  assert.match(request, /recordReaderReleaseRequest/);
  assert.match(workflow, /cron: "17 \* \* \* \*"/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /Complete durable release requests/);
});

test("legacy News backlog cannot be published after it becomes stale", () => {
  const now = Date.parse("2026-08-29T12:00:00Z");
  assert.equal(assessQueueFreshness({ pipeline_kind: "news", published_at: "2019-01-01T00:00:00Z" }, now).eligible, false);
  assert.equal(assessQueueFreshness({ pipeline_kind: "news", published_at: "2026-08-28T00:00:00Z" }, now).eligible, true);
  assert.equal(assessQueueFreshness({ pipeline_kind: "coaching", published_at: "2024-01-01T00:00:00Z" }, now).eligible, true);
});

test("RSS is database-backed instead of a permanently static placeholder", () => {
  assert.equal(fs.existsSync(new URL("../public/feed.xml", import.meta.url)), false);
  const feed = read("app/feed.xml/route.js");
  assert.match(feed, /loadNewsArticles/);
  assert.match(feed, /loadCurrentAffairsArticles/);
  assert.match(feed, /s-maxage=60/);
});

test("canonical sitemap uses a bounded freshness cache", () => {
  const sitemap = read("app/sitemap.ts");
  assert.match(sitemap, /revalidate: 300/);
  assert.doesNotMatch(sitemap, /revalidate: 3600/);
});
