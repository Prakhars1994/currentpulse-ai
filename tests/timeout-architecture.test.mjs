import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("Current Affairs collection is AI-free and source-bounded", () => {
  const source = read("lib/coverage/queueCoverageImport.js");
  assert.match(source, /COVERAGE_SOURCE_TIMEOUT_MS/);
  assert.match(source, /withSourceDeadline/);
  assert.match(source, /const shouldPublishImmediately = false/);
  assert.match(source, /COVERAGE_PERSIST_CONCURRENCY = 6/);
  for (const excluded of [
    "fetchBankersAddaTopics",
    "fetchOliveboardTopics",
    "fetchAffairsCloudTopics",
    "fetchTestbookCurrentAffairsTopics",
    "fetchGkTodayTopics",
  ]) {
    assert.doesNotMatch(source, new RegExp(excluded));
  }
});

test("full News and ResultPulse work is batchable", () => {
  const news = read("app/api/auto-publish/route.js");
  const exams = read("app/api/exams/run/route.js");
  assert.match(news, /newsBatch/);
  assert.match(news, /newsBatchSize/);
  assert.match(news, /full-batch/);
  assert.match(exams, /examBatch/);
  assert.match(exams, /examBatchSize/);
  assert.match(exams, /full-batch/);
});

test("maintenance endpoints use bounded cursor pages", () => {
  const editorial = read("app/api/editorial-cleanup/route.js");
  const quality = read("app/api/quality-repair/route.js");
  for (const source of [editorial, quality]) {
    assert.match(source, /nextBefore/);
    assert.match(source, /hasMore/);
    assert.match(source, /\.lt\("created_at", before\)/);
  }
  for (const source of [editorial, quality]) {
    assert.match(source, /MAX_MAINTENANCE_ROWS = 120/);
    assert.match(source, /MAINTENANCE_WRITE_CONCURRENCY = 4/);
    assert.match(source, /MAINTENANCE_DEADLINE_MS = 110000/);
    assert.match(source, /deadlineExhausted/);
  }
});

test("static reader has a global release deadline and keeps sitemap recency", () => {
  const source = read("scripts/materialize-static-reader.mjs");
  assert.match(source, /budget-seconds/);
  assert.match(source, /materializationBudgetMs/);
  assert.match(source, /budgetExhausted/);
  assert.match(source, /recentlyChangedPaths/);
  assert.match(source, /lastModified/);
});

test("automation stops queue drain after provider outage", () => {
  const workflow = read(".github/workflows/currentpulse-background.yml");
  assert.match(workflow, /Provider outage confirmed/);
  assert.match(workflow, /break/);
  assert.doesNotMatch(workflow, /then\s*\n\s*\n\s*fi/);
});

test("a permanent local production worktree finder exists", () => {
  const source = read("tools/find-currentpulse-production.ps1");
  assert.match(source, /origin\/main/);
  assert.match(source, /CurrentPulse-LIVE-MAIN/);
  assert.match(source, /No clean local checkout exactly matches/);
});
