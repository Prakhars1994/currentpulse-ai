import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Current Affairs admin review feed is authenticated and PDF-only", () => {
  const route = read("app/api/admin/current-affairs/route.js");
  assert.match(route, /requireAuthenticatedAdmin/);
  assert.match(route, /article_sources!inner/);
  assert.match(route, /source_kind", "coaching"/);
  assert.match(route, /source_key", "pdf:%"/);
  assert.match(route, /\.limit\(200\)/);
});

test("legacy standalone Current Affairs form is replaced by PDF review workspace", () => {
  const page = read("app/admin/current-affairs/page.js");
  assert.match(page, /PdfImportWorkspace/);
  assert.match(page, /\/api\/admin\/current-affairs/);
  assert.match(page, /Review & publish Current Affairs/);
  assert.match(page, /\/admin\/articles\/edit\/\$\{article\.id\}/);
  assert.doesNotMatch(page, /\/api\/upload/);
  assert.doesNotMatch(page, /status:\s*"published"/);
});
