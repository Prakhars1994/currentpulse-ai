import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../app/api/admin/pdf-import/publish/route.js", import.meta.url), "utf8");
const postBody = source.slice(source.indexOf("export async function POST"));

test("PDF batch publish defers per-article image enrichment", () => {
  assert.ok(postBody.includes("imageEnrichmentDeferred: true"));
  assert.ok(postBody.includes('? "provided" : "deferred"'));
  assert.equal(postBody.includes("await enrichPublishedArticleImage("), false);
  assert.equal(postBody.includes("await enrichExistingPdfArticle("), false);
  assert.equal(postBody.includes("await loadReusableImageBank("), false);
});

test("duplicate PDF rows stay idempotent and cheap", () => {
  assert.ok(postBody.includes('status: "duplicate"'));
  assert.ok(postBody.includes('status: "unchanged_or_deferred"'));
});

test("new PDF publications carry the current CA quality version", () => {
  assert.match(source, /quality_version:\s*6/);
  assert.match(source, /structure_validated/);
});
