import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  assessExamSitemapRecord,
  isStandaloneCurrentAffairsArticle,
  selectExamSitemapRecords,
} from "../lib/sitemapQuality.js";

const root = new URL("../", import.meta.url);
const read = (file) => fs.readFileSync(new URL(file, root), "utf8");

test("canonical host and legacy path-preserving permanent redirects remain intentional", () => {
  assert.match(read("lib/siteUrl.js"), /https:\/\/cp\.vliab\.workers\.dev/);
  const redirects = JSON.parse(read("vercel.json")).redirects;
  for (const host of ["currentpulse-ai.vercel.app", "currentpulse-ai-kl7x.vercel.app"]) {
    const rule = redirects.find((item) => item.has?.some((entry) => entry.value === host));
    assert.ok(rule);
    assert.equal(rule.source, "/(.*)");
    assert.equal(rule.destination, "https://cp.vliab.workers.dev/$1");
    assert.equal(rule.permanent, true);
  }
});

test("Current Affairs and News landing pages remain indexable", () => {
  const currentAffairs = read("app/current-affairs/page.js");
  const news = read("app/news/page.js");
  assert.match(currentAffairs, /alternates:\s*\{\s*canonical/);
  assert.match(currentAffairs, /:\s*\{\s*index:\s*true,\s*follow:\s*true\s*\}/);
  assert.match(news, /alternates:\s*\{\s*canonical/);
  assert.doesNotMatch(news, /index:\s*false/);
});

test("standalone CA is allowed while helper fragments are excluded", () => {
  assert.equal(isStandaloneCurrentAffairsArticle({ title: "India's Revised FDI Framework", slug: "india-revised-fdi-framework" }), true);
  assert.equal(isStandaloneCurrentAffairsArticle({ title: "RELATED UPSC PYQ", slug: "related-upsc-pyq-20260825-abc" }), false);
  assert.equal(isStandaloneCurrentAffairsArticle({ title: "• UPI → NPCI", slug: "upi-npci-20260825-abc" }), false);
  assert.equal(isStandaloneCurrentAffairsArticle({ title: "Prelims facts", slug: "prelims-facts-abc" }), false);
  for (const [title, slug] of [
    ["CURRENTPULSE AI", "currentpulse-ai-20260826-266b0bc-0"],
    ["OPEN CURRENTPULSE AI -> cp.vliab.workers.dev", "open-currentpulse-ai-cpvliabworkersdev-20260826-266b0bc-1"],
    ["26 AUG 2026 TOPIC MIX", "26-aug-2026-topic-mix"],
    ["TODAY'S 5", "todays-5"],
    ["NEWS STATIC + EVIDENCE PRELIMS + MAINS", "news-static-evidence-prelims-mains"],
    ["HOW TO USE THIS 7-PAGE BRIEF", "how-to-use-this-7-page-brief"],
  ]) {
    assert.equal(isStandaloneCurrentAffairsArticle({ title, slug }), false, title);
  }
});

test("exam sitemap keeps useful and future-dated updates but removes generic and duplicate events", () => {
  const valid = { slug: "upsc-cse-october-2026-exam-date", title: "UPSC Civil Services Examination scheduled for October 2026", source_name: "UPSC", update_type: "exam-date", official_url: "https://upsc.gov.in/notice", exam_date: "2026-10-10T00:00:00Z" };
  assert.equal(assessExamSitemapRecord(valid).allowed, true);
  assert.equal(assessExamSitemapRecord({ ...valid, slug: "nav-apply-online-12345678", title: "Apply Online" }).allowed, false);
  const selected = selectExamSitemapRecords([valid, { ...valid, slug: "upsc-cse-october-2026-exam-date-copy" }]);
  assert.equal(selected.included.length, 1);
  assert.equal(selected.excluded[0].reason, "duplicate_event");
});

test("sitemap and static reader share quality gates and legacy news sitemap stays a 308 compatibility redirect", () => {
  const sitemap = read("app/sitemap.ts");
  const reader = read("scripts/materialize-static-reader.mjs");
  assert.match(sitemap, /selectExamSitemapRecords/);
  assert.match(sitemap, /isCurrentAffairsReady/);
  assert.match(reader, /isStandaloneCurrentAffairsArticle/);
  assert.match(reader, /assessExamSitemapRecord/);
  const legacy = read("app/news-sitemap.xml/route.js");
  assert.match(legacy, /NextResponse\.redirect\(`\$\{SITE_URL\}\/sitemap\.xml`, 308\)/);
  assert.doesNotMatch(read("app/robots.ts"), /news-sitemap\.xml/);
});

test("publication gate rejects PDF helper sections before database insertion", () => {
  const route = read("app/api/admin/pdf-import/publish/route.js");
  assert.match(route, /isStandaloneCurrentAffairsArticle\(payload\)/);
  assert.ok(route.indexOf("isStandaloneCurrentAffairsArticle(payload)") < route.indexOf("\.from(\"articles\")\n        \.insert"));
});
