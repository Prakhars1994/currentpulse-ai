import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const load = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Conversation review is no longer scheduled by the production background workflow", () => {
  const workflow = load(".github/workflows/currentpulse-background.yml");
  assert.doesNotMatch(workflow, /conversation-review-/);
  assert.doesNotMatch(workflow, /refresh-conversation-review/);
});

test("manual Conversation review retains the 9pm-to-9pm editorial helpers", () => {
  const script = load("scripts/refresh-conversation-review.mjs");
  assert.match(script, /istDateToUtc\(yesterday, 21\)/);
  assert.match(script, /istDateToUtc\(today, 21\)/);
});

test("admin review keeps full article fetching lazy", () => {
  const route = load("app/api/admin/review/the-conversation/route.js");
  const script = load("scripts/refresh-conversation-review.mjs");
  assert.match(route, /fetchTheConversationRepublish\(previewUrl\)/);
  assert.doesNotMatch(script, /fetchTheConversationRepublish/);
});
