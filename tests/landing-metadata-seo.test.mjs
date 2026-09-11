import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { hasFutureLeadingExamListingDate } from "../lib/sitemapQuality.js";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("major indexable landing pages define page-specific social metadata", () => {
  const currentAffairs = read("app/current-affairs/page.js");
  const news = read("app/news/page.js");
  const exams = read("app/exams/page.js");
  const questionPapers = read("app/question-papers/page.js");
  const category = read("app/category/[slug]/page.tsx");

  for (const source of [currentAffairs, news, exams, questionPapers, category]) {
    assert.match(source, /openGraph\s*:/);
    assert.match(source, /twitter\s*:/);
    assert.match(source, /summary_large_image/);
  }

  assert.match(exams, /ResultPulse AI — Exam Results, Admit Cards & Notifications/);
  assert.match(questionPapers, /UPSC Previous Papers — 16 Prelims & 15 Mains Years/);
});

test("all sitemap landing pages avoid inherited homepage metadata", () => {
  const helper = read("lib/landingMetadata.js");
  assert.match(helper, /alternates:\s*\{ canonical \}/);
  assert.match(helper, /openGraph:/);
  assert.match(helper, /twitter:/);

  const leafLayouts = [
    "app/categories/layout.js",
    "app/quiz/layout.js",
    "app/pyq/layout.js",
    "app/videos/layout.js",
    "app/about/layout.js",
    "app/contact/layout.js",
    "app/editorial-methodology/layout.js",
    "app/sources-policy/layout.js",
    "app/ai-usage-policy/layout.js",
    "app/corrections-policy/layout.js",
    "app/privacy/layout.js",
    "app/terms/layout.js",
  ];
  for (const path of leafLayouts) {
    assert.match(read(path), /landingMetadata\(/, `${path} must define route-specific metadata`);
  }

  assert.match(read("app/pdf/page.js"), /landingMetadata\(/);
  assert.match(read("app/mock-tests/page.js"), /landingMetadata\(/);
});

test("notes route has a hard HTTP noindex fallback", () => {
  const nextConfig = read("next.config.ts");
  assert.match(nextConfig, /source:\s*['"]\/notes['"]/);
  assert.match(nextConfig, /key:\s*['"]X-Robots-Tag['"]/);
  assert.match(nextConfig, /value:\s*['"]noindex, follow['"]/);
});

test("ResultPulse future listing-date prefixes are rejected without blocking ordinary future event mentions", () => {
  const now = Date.UTC(2026, 8, 11, 12, 0, 0);
  assert.equal(hasFutureLeadingExamListingDate("15 Sep 2026 NOTICE REGARDING ADVT. NO. A-1/2026", now), true);
  assert.equal(hasFutureLeadingExamListingDate("09 Oct 2026 LIST OF CANDIDATES QUALIFIED FOR MAINS", now), true);
  assert.equal(hasFutureLeadingExamListingDate("11 Sep 2026 RESULT OF ADVT. NO. D-4/E-1/2025", now), false);
  assert.equal(hasFutureLeadingExamListingDate("Admit card released; exam scheduled for 15 Sep 2026", now), false);
});
