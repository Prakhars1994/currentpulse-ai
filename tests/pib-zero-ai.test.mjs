import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("PIB Today News collector is permanently disabled and uses zero AI/network work", () => {
  const route = read("app/api/fetch-todays-news/route.js");
  assert.match(route, /manual_publishing_only/);
  assert.match(route, /status:\s*410/);
  assert.doesNotMatch(route, /@\/lib\/ai\/evaluateNews|\bevaluateNews\s*\(/);
  assert.doesNotMatch(route, /classifyNewsCategory|assessNewsCandidate|fetch\s*\(/);
});
