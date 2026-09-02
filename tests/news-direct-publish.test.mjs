import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const load = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("legacy auto-publish is permanently disabled", () => {
  const route = load("app/api/auto-publish/route.js");
  assert.match(route, /manual_publishing_only/);
  assert.match(route, /status:\s*410/);
  assert.doesNotMatch(route, /AUTOMATED_NEWS_ENABLED|publishArticle|queueCoverageImport/);
});

test("production background is ResultPulse-only and does not run CA or News pipelines", () => {
  const background = load(".github/workflows/currentpulse-background.yml");
  assert.match(background, /\/api\/exams\/run/);
  assert.doesNotMatch(background, /auto-publish|coverage-import|fetch-all-news|fetch-todays-news|process-queue|drain_queue/);
});
