import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  buildConversationPageFallback,
  sanitizeConversationRepublishHtml,
} from "../lib/news/theConversation.js";

function load(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("Conversation page fallback preserves exact body and required credits/counter", () => {
  const body = "Research evidence ".repeat(70);
  const canonical = "https://theconversation.com/research-evidence-story-286999";
  const html = `
    <html><body>
      <a href="/profiles/example-author-1">Example Author</a>
      <a href="/institutions/example-university-1">Example University</a>
      <article><div itemprop="articleBody"><p>${body}</p></div></article>
    </body></html>
  `;

  const fallback = buildConversationPageFallback(html, canonical, "286999");
  const sanitized = sanitizeConversationRepublishHtml(fallback, canonical);

  assert.match(sanitized, /Research evidence/);
  assert.match(sanitized, /Example Author/);
  assert.match(sanitized, /Example University/);
  assert.match(sanitized, /counter\.theconversation\.com\/content\/286999\/count\.gif/);
  assert.match(sanitized, /original article/);
});

test("automatic News route performs no collection or duplicate work", () => {
  const route = load("app/api/auto-publish/route.js");
  const publisher = load("lib/publisher/publishArticle.js");

  assert.match(route, /manual_publishing_only/);
  assert.match(route, /status:\s*410/);
  assert.doesNotMatch(route, /NEWS_MAX_PUBLISH_PER_RUN|loadRecentArticles|duplicateSnapshot|publishArticle/);
  assert.match(publisher, /findDuplicateInArticles/);
  assert.match(publisher, /sourceItem\.duplicateSnapshot/);
});

test("public list paths no longer fetch full News/CA bodies", () => {
  const streams = load("lib/articleStreams.js");
  const newsList = streams.match(/const NEWS_LIST_FIELDS_INNER = `([\s\S]*?)`;/m)?.[1] || "";
  const caList = streams.match(/const CURRENT_AFFAIRS_LIST_FIELDS_INNER = `([\s\S]*?)`;/m)?.[1] || "";
  assert.doesNotMatch(newsList, /\bcontent\b/);
  assert.doesNotMatch(newsList, /\banswer_framework\b/);
  assert.doesNotMatch(newsList, /\bmemory_trick\b/);
  assert.doesNotMatch(caList, /\bcontent\b/);
  assert.doesNotMatch(caList, /\banswer_framework\b/);
  assert.match(streams, /CACHE_TTL_MS = 60_000/);
});

test("queue and coaching-state recurring reads are bounded", () => {
  const queue = load("app/api/process-queue/route.js");
  const coverage = load("lib/coverage/queueCoverageImport.js");
  assert.doesNotMatch(queue, /\.select\("\*"\)[\s\S]{0,180}\.limit\(200\)/);
  assert.match(queue, /\.limit\(48\)/);
  assert.match(queue, /\.limit\(240\)/);
  assert.match(queue, /\.limit\(300\)/);
  assert.match(coverage, /\.limit\(1500\)/);
  assert.match(coverage, /\.limit\(500\)/);
});

test("admin dashboard uses exact counts and only five recent rows", () => {
  const api = load("app/api/articles/route.js");
  const page = load("app/admin/page.jsx");
  assert.match(api, /mode"\) === "dashboard"/);
  assert.match(api, /count:\s*"exact",\s*head:\s*true/);
  assert.match(api, /\.limit\(5\)/);
  assert.match(page, /\/api\/articles\?mode=dashboard/);
});
