import test from "node:test";
import assert from "node:assert/strict";
import { archivePage, archiveHref, hindiArchiveHref, validArchiveDate } from "../lib/archiveSeo.js";

test("archive pagination rejects malformed and unsafe offsets", () => {
  assert.equal(archivePage(undefined), 1);
  assert.equal(archivePage("2"), 2);
  for (const value of ["", "0", "-1", "1.5", "Infinity", "9007199254740992", ["2", "3"]]) {
    assert.equal(archivePage(value), null, String(value));
  }
});

test("archive dates reject impossible calendar dates", () => {
  assert.equal(validArchiveDate("2024-02-29"), true);
  for (const date of ["2026-02-29", "2026-04-31", "2026-13-01", "bad", ["2026-09-09"]]) {
    assert.equal(validArchiveDate(date), false);
  }
});

test("each archive page retains its date, language and exam in canonical links", () => {
  assert.equal(archiveHref(), "/current-affairs");
  const first = archiveHref({ date: "2026-09-09", exam: "banking", lang: "hi" });
  const second = archiveHref({ date: "2026-09-09", page: 2, exam: "banking", lang: "hi" });
  assert.notEqual(first, second);
  const params = new URL(second, "https://example.com").searchParams;
  assert.deepEqual(Object.fromEntries(params), { date: "2026-09-09", page: "2", exam: "banking", lang: "hi" });
  assert.equal(hindiArchiveHref(1), "/current-affairs/hindi");
  assert.equal(hindiArchiveHref(2), "/current-affairs/hindi?page=2");
});
