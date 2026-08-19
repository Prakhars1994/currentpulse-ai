import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  enumerateHistoryDates,
  historyDateWindow,
  normalizeHistoryDate,
} from "../lib/automation/history.js";
import { assessCoverageEvidence } from "../lib/coverage/evidence.js";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("historical collection uses exact India-day windows", () => {
  assert.equal(normalizeHistoryDate("2026-02-30"), "");
  assert.deepEqual(historyDateWindow("2026-08-01"), {
    date: "2026-08-01",
    start: "2026-07-31T18:30:00.000Z",
    end: "2026-08-01T18:30:00.000Z",
    nextDate: "2026-08-02",
  });
  assert.deepEqual(enumerateHistoryDates("2026-08-01", "2026-08-03"), [
    "2026-08-01",
    "2026-08-02",
    "2026-08-03",
  ]);
});

test("weak Current Affairs evidence is rejected before scarce AI is used", () => {
  const weak = assessCoverageEvidence({
    sourceName: "Vision IAS",
    sourceUrl: "https://visionias.in/example",
    summary: "A short teaser without enough retained source detail.",
  });
  assert.equal(weak.accepted, false);
  assert.equal(weak.code, "insufficient_source_evidence");

  const fact = "The Ministry published its 2026 Report with quantified implementation data and institutional responsibilities for the new national programme.";
  const strong = assessCoverageEvidence({
    sourceName: "Vision IAS",
    sourceUrl: "https://visionias.in/example",
    summary: Array.from({ length: 7 }, (_, index) => `${fact} Finding ${index + 1} records 125 verified cases.`).join(" "),
  });
  assert.equal(strong.accepted, true);
});

test("News publishing is zero-AI while coverage retains synthesis", () => {
  const publisher = read("lib/publisher/publishArticle.js");
  assert.match(
    publisher,
    /generationMode === "news"[\s\S]*?buildSourceGroundedNewsFallback[\s\S]*?: await generateArticle/
  );
  assert.match(publisher, /NEWS_ENRICHMENT_DEADLINE_MS/);
});

test("Current Affairs keeps its retry queue while News publishes directly", () => {
  const processor = read("app/api/process-queue/route.js");
  const workflow = read(".github/workflows/currentpulse-background.yml");
  const autoPublish = read("app/api/auto-publish/route.js");

  // Legacy News rows remain processable, but new News bypasses article_queue.
  assert.match(processor, /new Set\(\["mixed", "news", "coverage"\]\)/);
  assert.match(processor, /preferredMixedLane/);

  // Current Affairs keeps its durable AI retry queue.
  assert.match(workflow, /drain_queue 300 coverage/);

  // Normal News no longer waits in that queue.
  assert.doesNotMatch(workflow, /drain_queue\s+\d+\s+news/);
  assert.match(autoPublish, /publishCandidatesDirectly/);
  assert.doesNotMatch(autoPublish, /queueCandidate/);
});

test("historical repair is bounded, resumable and auditable", () => {
  const historyWorkflow = read(".github/workflows/currentpulse-history-repair.yml");
  const audit = read("app/api/history-audit/route.js");
  assert.match(historyWorkflow, /maximum 7 inclusive days/);
  assert.match(historyWorkflow, /history-repair-report\/before\.json/);
  assert.match(historyWorkflow, /history-repair-report\/after\.json/);
  assert.match(historyWorkflow, /pipeline=\$\{lane\}/);
  assert.match(audit, /APPROVED_UPSC_COVERAGE_SOURCES/);
  assert.match(audit, /source_published_at/);
  assert.match(audit, /truncated/);
});

test("RSS and downstream fetches use whole-operation deadlines", () => {
  const rss = read("lib/news/rss.js");
  const enricher = read("lib/news/sourceEnricher.js");
  const extractor = read("lib/news/imageExtractor.js");
  assert.match(rss, /const text = await response\.text\(\)/);
  assert.match(rss, /finally \{\s*clearTimeout\(timeoutId\)/);
  assert.match(rss, /source\.rssUrl && !options\.historyDate/);
  assert.match(enricher, /deadlineAt/);
  assert.match(extractor, /deadlineAt/);
});
