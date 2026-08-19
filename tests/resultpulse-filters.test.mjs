import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { EXAM_FILTER_GROUPS, EXAM_FILTER_SOURCES, normalizeExamFilters } from "../lib/exams/filters.js";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("ResultPulse filter metadata covers the intended groups and authorities", () => {
  assert.deepEqual(EXAM_FILTER_GROUPS, ["UPSC", "SSC", "Railways", "Banking", "Entrance Exams", "Defence", "State PSC"]);
  assert.deepEqual(
    EXAM_FILTER_SOURCES.map((source) => source.id),
    ["upsc", "ssc", "nta", "ibps", "sbi", "rrcb", "rrb-cdg", "iaf", "navy", "uppsc", "rpsc-results"]
  );
});

test("ResultPulse filter normalization is bounded and rejects unknown selectors", () => {
  assert.deepEqual(
    normalizeExamFilters({ type: "result", group: "Railways", source: "rrb-cdg", q: " NTPC (Graduate), 2026 " }),
    { type: "result", group: "Railways", source: "rrb-cdg", q: "NTPC Graduate 2026" }
  );
  assert.deepEqual(
    normalizeExamFilters({ type: "fake", group: "Unknown", source: "fake", q: "CGL" }),
    { type: "", group: "", source: "", q: "CGL" }
  );
});

test("ResultPulse pushes filters into bounded Supabase reads without AI", () => {
  const repository = read("lib/exams/repository.js");
  assert.match(repository, /\.eq\("update_type", active\.type\)/);
  assert.match(repository, /\.eq\("source_group", active\.group\)/);
  assert.match(repository, /\.eq\("source_name", sourceFilter\.label\)/);
  assert.match(repository, /exam_name\.ilike/);
  assert.match(repository, /candidateLimit/);

  const combined = `${repository}\n${read("lib/exams/filters.js")}\n${read("components/ExamUpdatesPage.jsx")}\n${read("app/exams/page.js")}`;
  assert.doesNotMatch(combined, /@\/lib\/ai\//);
  assert.doesNotMatch(combined, /generateWithRouter|generateContent|Gemini|OpenRouter|Cerebras/);
});

test("ResultPulse filters are GET-based and bookmarkable", () => {
  const page = read("components/ExamUpdatesPage.jsx");
  const route = read("app/exams/page.js");
  assert.match(page, /<form method="get" action="\/exams"/);
  assert.match(page, /name="group"/);
  assert.match(page, /name="source"/);
  assert.match(page, /name="type"/);
  assert.match(page, /name="q"/);
  assert.match(route, /searchParams/);
});
