import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("published PDF library renders rows outside the fixed slot map", () => {
  const source = read("components/ExamPdfLibrary.jsx");
  assert.match(source, /rows\.filter\(\(row\) => !represented\.has\(row\.id\)\)/);
  assert.match(source, /Other published exam PDFs/);
  assert.match(source, /row\.title \|\| row\.original_filename/);
});

test("feed route emits a dynamic RSS 2.0 channel with validated article items", () => {
  const source = read("app/feed.xml/route.js");
  assert.match(source, /export const dynamic = "force-dynamic"/);
  assert.match(source, /export const revalidate = 0/);
  assert.match(source, /<rss version="2\.0"><channel>/);
  assert.match(source, /<item><title>/);
  assert.match(source, /item\.title && item\.slug/);
  assert.match(source, /loadNewsArticles/);
  assert.match(source, /loadCurrentAffairsArticles/);
});
