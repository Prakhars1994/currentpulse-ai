import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

function load(relative) {
  return fs.readFileSync(new URL(`../${relative}`, import.meta.url), "utf8");
}

test("Admin home embeds PDF intake and Conversation review", () => {
  const dashboard = load("app/admin/page.jsx");
  const workspace = load("components/admin/ConversationReviewWorkspace.jsx");
  const route = load("app/api/admin/review/the-conversation/route.js");

  assert.match(dashboard, /PdfImportWorkspace/);
  assert.match(dashboard, /ConversationReviewWorkspace/);
  assert.match(dashboard, /<PdfImportWorkspace embedded \/>/);
  assert.match(dashboard, /<ConversationReviewWorkspace embedded \/>/);

  assert.match(workspace, /General Public News/);
  assert.match(workspace, /setSelected\(new Set\(nextItems\.map/);
  assert.match(workspace, /offset \+= 8/);
  assert.match(workspace, /readApiJson/);
  assert.match(workspace, /instead of JSON/);
  assert.match(workspace, /Deselect all/);
  assert.match(workspace, /Already published/);
  assert.match(workspace, /await load\(\)/);
  assert.match(route, /publishedItems/);
  assert.doesNotMatch(workspace, /selected\.size\}\/8/);
});

test("Conversation public-interest filter defaults broadly to keep", async () => {
  const file = path.resolve(
    process.cwd(),
    "lib/news/conversationPublicInterest.js"
  );
  const mod = await import(`${pathToFileURL(file).href}?v=${Date.now()}`);

  assert.equal(
    mod.isGeneralPublicConversationItem({
      title: "Why water shortages are becoming a political problem",
      description: "An explainer for readers.",
    }),
    true
  );

  assert.equal(
    mod.isGeneralPublicConversationItem({
      title: "Call for papers for our academic workshop",
      description: "Submit abstracts.",
    }),
    false
  );

  assert.equal(
    mod.isGeneralPublicConversationItem({
      title: "How automation is changing air traffic control",
      description: "Safety and regulation are changing.",
    }),
    true
  );
});

test("scheduled collector stores only general-public eligible metadata", () => {
  const script = load("scripts/refresh-conversation-review.mjs");
  assert.match(script, /isGeneralPublicConversationItem/);
  assert.match(script, /const publicItems = result\.items\.filter/);
  assert.match(script, /GENERAL_PUBLIC_ITEMS/);
  assert.match(script, /const rows = publicItems\.map/);
});

test("review migration preserves old statuses and adds review statuses", () => {
  const sql = load(
    "supabase/migrations/20260824_allow_conversation_review_statuses.sql"
  );

  for (const status of [
    "NEW",
    "GENERATING",
    "DRAFT",
    "PUBLISHED",
    "REJECTED",
    "review",
    "review_batch",
  ]) {
    assert.match(sql, new RegExp(`'${status}'`));
  }
});
