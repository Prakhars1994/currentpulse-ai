import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  conversationArticleId,
  isTheConversationUrl,
  sanitizeConversationRepublishHtml,
} from "../lib/news/theConversation.js";
import {
  APPROVED_UPSC_COVERAGE_SOURCE_IDS,
} from "../lib/coverage/sourcePolicy.js";
import {
  selectScheduledNewsSources,
} from "../lib/automation/schedulePolicy.js";

function load(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("The Conversation is News-only and excluded from automatic News publishing", () => {
  const catalog = load("lib/news/sourceCatalog.js");

  assert.match(catalog, /id:\s*"the-conversation"/);
  assert.match(catalog, /reviewOnly:\s*true/);
  assert.equal(
    APPROVED_UPSC_COVERAGE_SOURCE_IDS.includes("the-conversation"),
    false
  );

  const sources = [
    {
      id: "the-conversation",
      group: "global-news",
      reviewOnly: true,
    },
    {
      id: "reuters-world",
      group: "global-news",
      newsAgenda: true,
    },
  ];

  const selected = selectScheduledNewsSources(
    sources,
    new Date("2026-08-23T12:00:00Z")
  );

  assert.equal(
    selected.sources.some((source) => source.id === "the-conversation"),
    false
  );
});

test("The Conversation URL validation extracts the article id", () => {
  const url =
    "https://theconversation.com/example-research-backed-story-123456";

  assert.equal(isTheConversationUrl(url), true);
  assert.equal(conversationArticleId(url), "123456");
  assert.equal(
    isTheConversationUrl("https://example.com/example-story-123456"),
    false
  );
});

test("republish sanitation removes ordinary images but keeps links and page counter", () => {
  const html = `
    <p>Evidence with <a href="/topics/science-1">a source link</a>.</p>
    <img src="https://images.theconversation.com/example.jpg" alt="photo">
    <img src="https://counter.theconversation.com/content/123456/count.gif?distributor=republish-lightbox-basic">
    <p>This article is republished from
      <a href="https://theconversation.com">The Conversation</a>.
      Read the
      <a href="https://theconversation.com/example-research-backed-story-123456">original article</a>.
    </p>
  `;

  const sanitized = sanitizeConversationRepublishHtml(
    html,
    "https://theconversation.com/example-research-backed-story-123456"
  );

  assert.doesNotMatch(sanitized, /images\.theconversation\.com/);
  assert.match(sanitized, /counter\.theconversation\.com/);
  assert.match(
    sanitized,
    /https:\/\/theconversation\.com\/topics\/science-1/
  );
  assert.match(
    sanitized,
    /https:\/\/theconversation\.com\/example-research-backed-story-123456/
  );
});

test("admin review and licensed renderer are wired into News", () => {
  const route = load("app/api/admin/review/the-conversation/route.js");
  const admin = load("app/admin/news/page.js");
  const detail = load("app/news/[slug]/page.js");

  assert.match(route, /requireAuthenticatedAdmin/);
  assert.match(route, /publishTheConversationArticle/);
  assert.match(admin, /News-only republication/);
  assert.match(detail, /licensed_republish_the_conversation/);
  assert.match(detail, /LicensedNewsArticle/);
});
