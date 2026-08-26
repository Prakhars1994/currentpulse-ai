import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { suppressRepeatedArticleSections } from "../lib/articleSectionDedupe.js";
import { NEWS_SOURCES } from "../lib/news/sourceCatalog.js";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("atlas maps use numbered markers and external legends", () => {
  const source = read("components/ArticleStudyVisuals.jsx");
  assert.match(source, /number=\{index \+ 1\}/);
  assert.match(source, /map legend/);
  assert.doesNotMatch(source, /<b>\{label\}<\/b>/);
});

test("Prelims practice card is collapsed and answer reveal is separate", () => {
  const card = read("components/PrelimsPracticeCard.jsx");
  assert.match(card, /<details id="prelims-practice"/);
  assert.match(card, /Show answer & explanation/);
  assert.match(card, /aria-hidden="true"/);
  assert.match(card, /if \(!parsed\?\.question\) return null/);
  assert.match(read("app/current-affairs/[slug]/page.js"), /value=\{displayArticle\.question\}/);
});

test("cross-section duplicate suppression preserves distinct facts", () => {
  const repeated = "The commission published a detailed framework covering institutions, finance, accountability, implementation and public reporting requirements.";
  const result = suppressRepeatedArticleSections({ why_news: repeated, static_foundation: repeated, prelims: "Distinct constitutional fact." });
  assert.equal(result.why_news, repeated);
  assert.equal(result.static_foundation, "");
  assert.equal(result.prelims, "Distinct constitutional fact.");
});

test("near-duplicate suppression preserves changed numbers, dates and institutions", () => {
  const base = "On 12 August 2026, the Finance Commission published a framework covering institutions, finance, accountability, implementation, reporting and grants worth 250 crore.";
  const changed = "On 13 August 2026, the Election Commission published a framework covering institutions, finance, accountability, implementation, reporting and grants worth 350 crore.";
  const result = suppressRepeatedArticleSections({ why_news: base, static_foundation: changed });
  assert.equal(result.static_foundation, changed);
});

test("exam PDF library always exposes the requested eight data-driven slots", () => {
  const source = read("lib/examPdfs.js");
  for (const slug of ["ssc", "bpsc", "banking", "uppcs", "yearly_updates", "mcq"]) assert.match(source, new RegExp(`slug: "${slug}"`));
  assert.match(source, /toLocaleDateString\("en-IN"/);
  assert.match(read("components/ExamPdfLibrary.jsx"), /EXAM_PDF_EXAMS\.flatMap/);
});

test("exam PDF migration and API enforce publication, type and safe replacement", () => {
  const migration = read("supabase/migrations/20260826183037_exam_pdf_library.sql");
  const api = read("app/api/admin/exam-pdfs/route.js");
  assert.match(migration, /where published/);
  assert.match(migration, /yearly_updates/);
  assert.doesNotMatch(migration, /insert into storage\.buckets/);
  assert.match(migration, /enable row level security/);
  assert.match(api, /requireAuthenticatedAdmin/);
  assert.match(api, /file\.type !== "application\/pdf"/);
  assert.match(api, /published: false/);
  assert.match(api, /published: true/);
  assert.match(api, /requestReaderRelease/);
});

test("public PDF area hides drafts and missing files", () => {
  const repository = read("lib/examPdfs.js");
  const library = read("components/ExamPdfLibrary.jsx");
  assert.match(repository, /\.eq\("published", true\)/);
  assert.match(library, /row \?/);
  assert.match(library, /Not published yet/);
  assert.match(library, /type="application\/pdf"/);
});

test("UPSC listing includes Essay and both compulsory qualifying papers", () => {
  const source = read("lib/upsc/questionPapers.js");
  assert.match(source, /paper: "Essay"/);
  assert.match(source, /Compulsory Indian Language/);
  assert.match(source, /Compulsory English/);
  assert.match(source, /direct: false/);
});

test("official News sources are citation-only and never treated as full-text feeds", () => {
  const official = NEWS_SOURCES.filter((source) => source.group === "official");
  assert.ok(official.length >= 12);
  assert.ok(official.every((source) => source.reuseMode === "facts-summary-only"));
  assert.ok(official.every((source) => /^[BCD]$/.test(source.reuseClass)));
  const route = read("app/api/auto-publish/route.js");
  assert.doesNotMatch(route, /OFFICIAL VERIFICATION/);
});
