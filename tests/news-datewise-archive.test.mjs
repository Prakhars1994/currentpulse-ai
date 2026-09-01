import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { assessNewsCandidate } from "../lib/editorial/publicationSafety.js";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("legacy queued News freshness logic remains bounded", () => {
  const base = { title: "Government announces a national transport safety measure", description: "The government announced a time-bound transport safety measure after an official meeting.", url: "https://example.com/news/transport-safety-measure", published_at: "2026-08-10T09:00:00.000Z" };
  assert.equal(assessNewsCandidate(base).allowed, false);
  assert.equal(assessNewsCandidate({ ...base, freshnessReferenceDate: "2026-08-10T12:00:00.000Z" }).allowed, true);
});

test("News archive is datewise", () => {
  const page = read("app/news/page.js");
  assert.match(page, /const pageSize = 48/);
  assert.match(page, /showDateHeading/);
});

test("public News visibility is based on admin PDF provenance, not automated quality re-gating", () => {
  const streams = read("lib/articleStreams.js");
  assert.match(streams, /hasAdminPdfSource/);
  assert.match(streams, /source_key/);
  assert.doesNotMatch(streams, /isArchiveWorthyNews\(article\)/);
});
