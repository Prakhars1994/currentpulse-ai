import test from "node:test";
import assert from "node:assert/strict";

import {
  selectScheduledCoverageSourceIds,
  selectScheduledExamSources,
  selectScheduledNewsSources,
} from "../lib/automation/schedulePolicy.js";

test("scheduled news keeps agenda sources every run and rotates supplements", () => {
  const sources = [
    { id: "core-a", group: "indian-news", newsAgenda: true },
    { id: "core-b", group: "global-news", newsAgenda: true },
    { id: "pib-direct", group: "official" },
    { id: "extra-1", group: "state-news" },
    { id: "extra-2", group: "official" },
    { id: "extra-3", group: "official" },
    { id: "extra-4", group: "official" },
    { id: "extra-5", group: "official" },
  ];
  const first = selectScheduledNewsSources(sources, new Date("2026-08-12T10:00:00Z"));
  const second = selectScheduledNewsSources(sources, new Date("2026-08-12T11:00:00Z"));
  for (const id of ["core-a", "core-b", "pib-direct"]) {
    assert.ok(first.selectedIds.includes(id));
    assert.ok(second.selectedIds.includes(id));
  }
  assert.notDeepEqual(first.selectedIds, second.selectedIds);
});

test("coverage rotation scans all 12 coaching sources across the real four IST CA windows", () => {
  process.env.COVERAGE_SOURCES_PER_RUN = "4";
  const coverage = Array.from({ length: 12 }, (_, index) => `source-${index + 1}`);
  const seen = new Set();
  // 06, 12, 19 and 22 IST expressed as UTC on the same India date.
  const windows = [
    "2026-08-15T00:30:00Z",
    "2026-08-15T06:30:00Z",
    "2026-08-15T13:30:00Z",
    "2026-08-15T16:30:00Z",
  ];
  for (const value of windows) {
    const batch = selectScheduledCoverageSourceIds(coverage, new Date(value));
    assert.equal(batch.length, 4);
    batch.forEach((id) => seen.add(id));
  }
  assert.deepEqual([...seen].sort(), [...coverage].sort());
  delete process.env.COVERAGE_SOURCES_PER_RUN;
});

test("exam rotation always keeps UPSC SSC Railway and Banking core hot", () => {
  process.env.EXAM_SOURCES_PER_RUN = "6";
  const exams = [
    { id: "upsc" }, { id: "ssc" }, { id: "nta" }, { id: "ibps" },
    { id: "sbi" }, { id: "rrcb" }, { id: "rrb-cdg" }, { id: "iaf" },
    { id: "navy" }, { id: "uppsc" }, { id: "rpsc-results" },
  ];
  const seen = new Set();
  const windows = [
    "2026-08-15T00:30:00Z",
    "2026-08-15T06:30:00Z",
    "2026-08-15T13:30:00Z",
    "2026-08-15T16:30:00Z",
  ];
  for (const value of windows) {
    const batch = selectScheduledExamSources(exams, new Date(value));
    assert.equal(batch.length, 6);
    for (const id of ["upsc", "ssc", "rrcb", "ibps"]) {
      assert.ok(batch.some((source) => source.id === id));
    }
    batch.forEach((source) => seen.add(source.id));
  }
  assert.ok(seen.has("nta"));
  assert.ok(seen.has("sbi"));
  assert.ok(seen.has("rrb-cdg"));
  assert.ok(seen.has("uppsc") || seen.has("rpsc-results"));
  delete process.env.EXAM_SOURCES_PER_RUN;
});
