import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  isConversationReviewDay,
} from "../lib/news/theConversation.js";

function load(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("Conversation review feed is all-English and today-only in IST", () => {
  const catalog = load("lib/news/sourceCatalog.js");
  const conversation = load("lib/news/theConversation.js");

  assert.match(
    catalog,
    /https:\/\/theconversation\.com\/articles\.atom\?language=en/
  );
  assert.match(conversation, /timeZone:\s*"Asia\/Kolkata"/);

  const now = new Date("2026-08-23T14:45:00Z");
  assert.equal(
    isConversationReviewDay("2026-08-23T02:00:00Z", now),
    true
  );
  assert.equal(
    isConversationReviewDay("2026-08-22T18:29:59Z", now),
    false
  );
});

test("admin News can preview the full sanitized Conversation article", () => {
  const route = load("app/api/admin/review/the-conversation/route.js");
  const page = load("components/admin/ConversationReviewWorkspace.jsx");
  const css = load("app/globals.css");

  assert.match(route, /searchParams\.get\("preview"\)/);
  assert.match(route, /fetchTheConversationRepublish/);
  assert.match(route, /previewHtmlWithoutCounter/);
  assert.match(page, /Preview full article/);
  assert.match(page, /dangerouslySetInnerHTML/);
  assert.match(css, /admin-conversation-preview-body/);
  assert.match(css, /licensed-republished-article/);
});

test("legacy automatic News is inactive unless explicitly re-enabled", () => {
  const route = load("app/api/auto-publish/route.js");
  const workflow = load(".github/workflows/currentpulse-background.yml");

  assert.match(route, /AUTOMATED_NEWS_ENABLED/);
  assert.match(
    route,
    /process\.env\.AUTOMATED_NEWS_ENABLED \|\| "false"/
  );
  assert.match(workflow, /AUTOMATED_NEWS_ENABLED:\s*"false"/);
});

test("one News mutation no longer fans out across every archive page", () => {
  const planner = load("scripts/public-release-paths.mjs");
  const materializer = load("scripts/materialize-static-reader.mjs");

  assert.doesNotMatch(
    planner,
    /for \(let page = 2; page <= NEWS_ARCHIVE_PAGES; page \+= 1\)/
  );
  assert.match(planner, /paths\.add\("\/news"\)/);
  assert.match(
    materializer,
    /Boolean\(changedFile\) \|\| CORE_PATHS\.includes/
  );
  assert.match(materializer, /!changedFile[\s\S]{0,120}paths\.length >= 25/);
});

test("SEO keeps licensed Conversation duplicates out of CurrentPulse indexing", () => {
  const detail = load("app/news/[slug]/page.js");
  const sitemap = load("app/sitemap.ts");
  const newsSitemap = load("app/news-sitemap.xml/route.js");
  const robots = load("app/robots.ts");
  const layout = load("app/layout.tsx");

  assert.match(detail, /licensedConversation[\s\S]{0,80}index:\s*false/);
  assert.match(sitemap, /source_name === "PB-SHABD"/);
  assert.match(newsSitemap, /NextResponse\.redirect/);
  assert.match(newsSitemap, /\/sitemap\.xml/);
  assert.doesNotMatch(robots, /news-sitemap\.xml/);
  assert.match(layout, /UPSC Current Affairs Today/);
});
