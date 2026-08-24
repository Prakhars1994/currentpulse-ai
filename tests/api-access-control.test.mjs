import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("internal operational routes require the existing administrator session", () => {
  for (const path of [
    "app/api/automation-status/route.js",
    "app/api/stats/route.js",
    "app/api/drishti-inspect/route.js",
  ]) {
    const source = read(path);
    assert.match(source, /requireAuthenticatedAdmin/);
    assert.match(source, /if \(!auth\.ok\) return auth\.response/);
  }
});

test("Ask AI limits uncached questions but preserves shared cache hits", () => {
  const source = read("app/api/ask-ai/route.js");
  assert.match(source, /MAX_UNCACHED_QUESTIONS_PER_WINDOW = 3/);
  assert.match(source, /cf-connecting-ip/);
  assert.match(source, /readAnswerCache\(cacheKey\)/);
  assert.match(source, /allowUncachedQuestion\(request\)/);
  assert.match(source, /status: 429/);
});
