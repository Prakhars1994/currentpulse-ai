import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("legacy News collectors are fail-closed and perform no external work", () => {
  for (const path of [
    "app/api/fetch-all-news/route.js",
    "app/api/fetch-todays-news/route.js",
  ]) {
    const source = read(path);
    assert.match(source, /manual_publishing_only/);
    assert.match(source, /status:\s*410/);
    assert.doesNotMatch(source, /fetchSourceRss|isCronAuthorized|cheerio|fetch\s*\(/);
  }
});

test("article RLS migration restricts public access and hardens definer functions", () => {
  const migration = read("supabase/migrations/20260824190000_secure_articles_and_automation.sql");
  assert.match(migration, /revoke all on table public\.articles from public, anon, authenticated/i);
  assert.match(migration, /grant select on table public\.articles to anon, authenticated/i);
  assert.match(migration, /using \(status = 'published'\)/);
  assert.match(migration, /'user'/);
  assert.match(migration, /revoke all on function public\.handle_new_user\(\)/i);
  assert.match(migration, /revoke all on function public\.increment_article_views\(text\)/i);
  assert.match(migration, /revoke all on function public\.rls_auto_enable\(\)/i);
});

test("automation run recovery only closes stale runs", () => {
  const source = read("lib/automation/runLog.js");
  assert.match(source, /STALE_RUN_AGE_HOURS = 6/);
  assert.match(source, /\.eq\("status", "running"\)/);
  assert.match(source, /\.lt\("started_at", staleBefore\)/);
  assert.match(source, /status: "failed"/);
});

test("workflows source CRON_SECRET from GitHub secrets", () => {
  for (const path of [
    ".github/workflows/currentpulse-background.yml",
    ".github/workflows/currentpulse-quality-maintenance.yml",
    ".github/workflows/currentpulse-history-repair.yml",
  ]) {
    assert.match(read(path), /CRON_SECRET: \$\{\{ secrets\.CRON_SECRET \}\}/);
  }
});
