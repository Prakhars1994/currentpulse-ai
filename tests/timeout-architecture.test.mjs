import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("maintenance endpoints remain bounded", () => {
  for (const source of [read("app/api/editorial-cleanup/route.js"), read("app/api/quality-repair/route.js")]) {
    assert.match(source, /MAX_MAINTENANCE_ROWS = 120/);
    assert.match(source, /MAINTENANCE_DEADLINE_MS = 110000/);
  }
});

test("static reader has a global release deadline", () => {
  const source = read("scripts/materialize-static-reader.mjs");
  assert.match(source, /budget-seconds/);
  assert.match(source, /materializationBudgetMs/);
});

test("production background has no CA or News provider/queue automation", () => {
  const workflow = read(".github/workflows/currentpulse-background.yml");
  assert.match(workflow, /\/api\/exams\/run/);
  assert.doesNotMatch(workflow, /Provider outage confirmed|process-queue|auto-publish|coverage-import/);
});

test("a permanent local production worktree finder exists", () => {
  const source = read("tools/find-currentpulse-production.ps1");
  assert.match(source, /origin\/main/);
  assert.match(source, /CurrentPulse-LIVE-MAIN/);
});
