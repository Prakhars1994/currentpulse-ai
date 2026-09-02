import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { isConversationReviewDay } from "../lib/news/theConversation.js";

const load = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Conversation review date logic remains IST-aware", () => {
  const now = new Date("2026-08-23T14:45:00Z");
  assert.equal(isConversationReviewDay("2026-08-23T02:00:00Z", now), true);
  assert.equal(isConversationReviewDay("2026-08-22T18:29:59Z", now), false);
});

test("legacy automatic News is fail-closed and absent from scheduled production", () => {
  const route = load("app/api/auto-publish/route.js");
  const workflow = load(".github/workflows/currentpulse-background.yml");
  assert.match(route, /manual_publishing_only/);
  assert.match(route, /status:\s*410/);
  assert.doesNotMatch(route, /NEWS_SOURCES|fetchSourceRss|queueCoverageImport|publishArticle/);
  assert.doesNotMatch(workflow, /auto-publish/);
  assert.doesNotMatch(workflow, /fetch-all-news|fetch-todays-news/);
});

test("News reader release remains incremental", () => {
  const planner = load("scripts/public-release-paths.mjs");
  assert.doesNotMatch(planner, /for \(let page = 2; page <= NEWS_ARCHIVE_PAGES; page \+= 1\)/);
  assert.match(planner, /paths\.add\("\/news"\)/);
});
