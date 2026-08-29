import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  EDITORIAL_SOURCE_NAME,
  inferAdminStream,
  normalizeAdminStream,
  sourceKindForStream,
} from "../lib/publisher/articleStream.js";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const route = read("app/api/articles/route.js");
const form = read("components/admin/ArticleForm.jsx");
const dispatch = read("lib/publisher/requestReaderRelease.js");
const dispatchRequest = read("lib/publisher/dispatchReaderRelease.js");
const planner = read("scripts/public-release-paths.mjs");

test("draft saves do not request a reader release", () => {
  assert.match(route, /if \(payload\.status === "published"\)/);
  assert.match(route, /"Draft saved successfully\."/);
});

test("manual Current Affairs publication uses coverage safety and editorial coaching attribution", () => {
  assert.equal(normalizeAdminStream("coverage"), "coverage");
  assert.equal(sourceKindForStream("coverage"), "coaching");
  assert.equal(EDITORIAL_SOURCE_NAME, "CurrentPulse Editorial");
  assert.match(form, /stream: data\.stream/);
  assert.match(route, /assessPublishedArticle\(payload, \{ stream \}\)/);
});

test("manual News publication uses news safety and classification", () => {
  assert.equal(normalizeAdminStream("news"), "news");
  assert.equal(sourceKindForStream("news"), "news");
  assert.equal(inferAdminStream({ article_sources: [{ source_kind: "news" }] }), "news");
});

test("published updates reuse or correct source rows before incremental refresh", () => {
  const sourceHelper = read("lib/publisher/articleStream.js");
  assert.match(sourceHelper, /const target = rows\.find/);
  assert.match(sourceHelper, /else if \(opposite\)/);
  assert.match(sourceHelper, /\.update\(update\)/);
  assert.match(route, /ensureArticleStream\(auth\.supabase, data, stream\)/);
  assert.match(route, /requestReaderRelease\(\{ articleId: data\.id, stream, supabase: auth\.supabase \}\)/);
});

test("dispatch failure preserves database success and returns a warning", () => {
  assert.match(route, /catch \(dispatchError\)/);
  assert.match(route, /readerRefreshQueued/);
  assert.match(route, /Article published to database, but live reader refresh could not be queued\./);
});

test("reader dispatch stays server-only, incremental, and does not expose its token", () => {
  assert.match(dispatch, /import "server-only"/);
  assert.match(dispatch, /GITHUB_READER_RELEASE_TOKEN/);
  assert.doesNotMatch(dispatch, /NEXT_PUBLIC_GITHUB/);
  assert.match(dispatchRequest, /full: "false"/);
  assert.match(dispatchRequest, /admin-publish:/);
  assert.match(planner, /paths\.add\("\/"\)/);
  assert.match(planner, /paths\.add\("\/sitemap\.xml"\)/);
  assert.match(planner, /paths\.add\("\/feed\.xml"\)/);
});
