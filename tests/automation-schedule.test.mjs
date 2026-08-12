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

test("coverage rotation scans every configured source across four hourly slots", () => {
  const coverage = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const seen = new Set();
  for (let hour = 10; hour < 14; hour += 1) {
    const batch = selectScheduledCoverageSourceIds(
      coverage,
      new Date(`2026-08-12T${hour}:00:00Z`)
    );
    assert.equal(batch.length, 2);
    batch.forEach((id) => seen.add(id));
  }
  assert.deepEqual([...seen].sort(), [...coverage].sort());
});

test("exam rotation keeps UPSC SSC NTA hot and covers all supplements", () => {
  const exams = [
    { id: "upsc" },
    { id: "ssc" },
    { id: "nta" },
    ...Array.from({ length: 8 }, (_, index) => ({ id: `exam-${index}` })),
  ];
  const seen = new Set();
  for (let slot = 0; slot < 4; slot += 1) {
    const batch = selectScheduledExamSources(
      exams,
      new Date(Date.parse("2026-08-12T10:00:00Z") + slot * 2 * 3_600_000)
    );
    assert.equal(batch.length, 5);
    for (const id of ["upsc", "ssc", "nta"]) {
      assert.ok(batch.some((source) => source.id === id));
    }
    batch.forEach((source) => seen.add(source.id));
  }
  assert.deepEqual(
    [...seen].sort(),
    exams.map((source) => source.id).sort()
  );
});
