import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

function load(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("Conversation inbox refreshes exactly at 10am 3pm and 9pm IST", () => {
  const workflow = load(".github/workflows/currentpulse-background.yml");

  assert.match(workflow, /30 4 \* \* \*/);
  assert.match(workflow, /30 9 \* \* \*/);
  assert.match(workflow, /30 15 \* \* \*/);
  assert.match(workflow, /conversation-review-10/);
  assert.match(workflow, /conversation-review-15/);
  assert.match(workflow, /conversation-review-21/);
});

test("Conversation review uses a 9pm-to-9pm editorial day", () => {
  const script = load("scripts/refresh-conversation-review.mjs");

  assert.match(script, /istDateToUtc\(yesterday, 21\)/);
  assert.match(script, /istDateToUtc\(today, hour\)/);
  assert.match(script, /istDateToUtc\(today, 21\)/);
  assert.match(script, /\[10, 15, 21\]/);
});

test("scheduled collection stores metadata only and full HTML stays lazy", () => {
  const script = load("scripts/refresh-conversation-review.mjs");
  const route = load("app/api/admin/review/the-conversation/route.js");
  const conversation = load("lib/news/theConversation.js");

  assert.match(script, /\.from\("news_queue"\)/);
  assert.match(script, /summary: item\.description/);
  assert.doesNotMatch(script, /fetchTheConversationRepublish/);
  assert.doesNotMatch(script, /\.from\("articles"\)/);
  assert.match(route, /fetchTheConversationRepublish\(previewUrl\)/);
  assert.match(conversation, /CONVERSATION_REVIEW_FEEDS/);
});

test("admin reads the latest scheduled batch instead of refetching all feeds", () => {
  const route = load("app/api/admin/review/the-conversation/route.js");

  assert.match(route, /\.eq\("status", "review_batch"\)/);
  assert.match(route, /\.eq\("status", "review"\)/);
  assert.doesNotMatch(route, /loadTheConversationReviewFeed/);
  assert.match(route, /\.limit\(240\)/);
});
