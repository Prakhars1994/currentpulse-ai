import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("routine content automation no longer rebuilds or deploys the whole reader", () => {
  const background = read(".github/workflows/currentpulse-background.yml");
  assert.doesNotMatch(background, /npx opennextjs-cloudflare build/);
  assert.doesNotMatch(background, /npx wrangler deploy/);
  assert.match(background, /public-release-state\.mjs/);
  assert.match(background, /currentpulse-reader-release\.yml/);
});

test("reader release restores the validated build and refreshes only recent changes", () => {
  const release = read(".github/workflows/currentpulse-reader-release.yml");
  const materializer = read("scripts/materialize-static-reader.mjs");
  assert.match(release, /actions\/cache\/restore@v4/);
  assert.match(release, /Fallback build only when cache is missing/);
  assert.match(release, /--reuse-local/);
  assert.match(materializer, /reuseLocal/);
  assert.match(materializer, /addRecentlyChangedDatabasePaths/);
  assert.match(materializer, /\.gte\("updated_at", since\)/);
});

test("production seeds the release cache after a validated full deployment", () => {
  const production = read(".github/workflows/currentpulse-production.yml");
  assert.match(production, /Save validated release snapshot/);
  assert.match(production, /currentpulse-release-\$\{\{ github\.sha \}\}/);
});

test("all public mutation workflows request the same reader release", () => {
  for (const file of [
    ".github/workflows/currentpulse-background.yml",
    ".github/workflows/currentpulse-quality-maintenance.yml",
    ".github/workflows/currentpulse-history-repair.yml",
  ]) {
    const workflow = read(file);
    assert.match(workflow, /actions: write/);
    assert.match(workflow, /Detect public content changes/);
    assert.match(workflow, /Request incremental reader release/);
  }
});

test("legacy Supabase News can be fully released without restoring the normal News queue", () => {
  const workflow = read(".github/workflows/currentpulse-background.yml");
  const processor = read("app/api/process-queue/route.js");
  const repair = read("app/api/news-quality-repair/route.js");
  assert.match(workflow, /news-release\)/);
  assert.match(workflow, /drain_queue 2700 news 220/);
  assert.match(workflow, /news-backlog-status\.mjs/);
  assert.match(processor, /recoverLegacyNewsQueue/);
  assert.match(processor, /assessNewsEditorialValue/);
  assert.match(repair, /nextCursor/);
  assert.match(repair, /query\.lt\("id", cursor\)/);
});