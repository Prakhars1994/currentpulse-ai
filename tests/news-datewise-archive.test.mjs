import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { assessNewsCandidate } from "../lib/editorial/publicationSafety.js";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("legacy queued News is judged against its collection date, not today's date", () => {
  const base = {
    title: "Government announces a new national transport safety measure",
    description: "The government announced a time-bound transport safety measure after an official meeting.",
    url: "https://example.com/news/transport-safety-measure",
    published_at: "2026-08-10T09:00:00.000Z",
  };

  assert.equal(assessNewsCandidate(base).allowed, false);
  assert.equal(
    assessNewsCandidate({
      ...base,
      freshnessReferenceDate: "2026-08-10T12:00:00.000Z",
    }).allowed,
    true
  );
});

test("News archive is explicitly datewise and keeps a larger historical page", () => {
  const page = read("app/news/page.js");
  assert.match(page, /const pageSize = 48/);
  assert.match(page, /showDateHeading/);
  assert.match(page, /dateLabel/);
  assert.match(page, /All retained stories stay in chronological archive/);
});

test("legacy queue processor carries its original collection timestamp into publication safety", () => {
  const processor = read("app/api/process-queue/route.js");
  assert.match(processor, /freshnessReferenceDate/);
  assert.match(processor, /claimedItem\.created_at \|\| claimedItem\.updated_at/);
});