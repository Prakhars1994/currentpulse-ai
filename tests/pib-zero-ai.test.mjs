import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

function read(path) {
  return fs.readFileSync(
    new URL(`../${path}`, import.meta.url),
    "utf8"
  );
}

test("PIB Today News uses deterministic evaluation and never calls AI", () => {
  const route = read("app/api/fetch-todays-news/route.js");

  assert.doesNotMatch(
    route,
    /@\/lib\/ai\/evaluateNews|\bevaluateNews\s*\(/
  );
  assert.doesNotMatch(
    route,
    /MAX_AI_EVALUATIONS|AI_CONCURRENCY|evaluateArticlesWithLimit/
  );
  assert.match(route, /classifyNewsCategory/);
  assert.match(route, /assessNewsCandidate/);
  assert.match(route, /evaluationMode:\s*"deterministic"/);
  assert.match(route, /aiConcurrency:\s*0/);
});
