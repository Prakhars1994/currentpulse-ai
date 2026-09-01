import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("legacy News recovery cannot reference an undefined coaching constant", () => {
  const processor = read("app/api/process-queue/route.js");
  assert.doesNotMatch(processor, /COACHING_PIPELINES/);
});

test("normal production has no legacy News release mode", () => {
  const workflow = read(".github/workflows/currentpulse-background.yml");
  assert.doesNotMatch(workflow, /news-release\)|auto-publish|drain_queue/);
  assert.match(workflow, /\/api\/exams\/run/);
});
