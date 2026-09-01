import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { enumerateHistoryDates, historyDateWindow, normalizeHistoryDate } from "../lib/automation/history.js";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("historical date utilities retain exact India-day windows", () => {
  assert.equal(normalizeHistoryDate("2026-02-30"), "");
  assert.deepEqual(historyDateWindow("2026-08-01"), { date: "2026-08-01", start: "2026-07-31T18:30:00.000Z", end: "2026-08-01T18:30:00.000Z", nextDate: "2026-08-02" });
  assert.deepEqual(enumerateHistoryDates("2026-08-01", "2026-08-03"), ["2026-08-01", "2026-08-02", "2026-08-03"]);
});

test("production background owns only ResultPulse scheduled work", () => {
  const workflow = read(".github/workflows/currentpulse-background.yml");
  assert.match(workflow, /\/api\/exams\/run/);
  assert.doesNotMatch(workflow, /drain_queue|auto-publish|coverage-import|process-queue|news-release/);
});

test("RSS helpers still use bounded operation deadlines", () => {
  const rss = read("lib/news/rss.js");
  assert.match(rss, /finally \{\s*clearTimeout\(timeoutId\)/);
});
