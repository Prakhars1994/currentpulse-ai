import test from "node:test";
import assert from "node:assert/strict";
import { assessExamSitemapRecord } from "../lib/sitemapQuality.js";

const base = {
  slug: "sbi-careers-useful-record-20260912",
  official_url: "https://sbi.co.in/careers",
  source_name: "SBI Careers",
  agency: "SBI",
  update_type: "application",
};

test("dated APPLY ONLINE navigation rows stay out of ResultPulse search indexing", () => {
  const assessment = assessExamSitemapRecord({
    ...base,
    title: "APPLY ONLINE (04.09.2026 to 24.09.2026)",
  });
  assert.equal(assessment.allowed, false);
  assert.equal(assessment.code, "generic_navigation_item");
});

test("descriptive exam application updates remain indexable", () => {
  const assessment = assessExamSitemapRecord({
    ...base,
    title: "SBI PO 2026 Applications Open for 2,000 Probationary Officer Posts",
  });
  assert.equal(assessment.allowed, true);
});

test("descriptive download-related exam updates are not over-filtered", () => {
  const assessment = assessExamSitemapRecord({
    ...base,
    update_type: "admit-card",
    title: "SBI PO Main Exam Call Letter Released for 2026 Examination",
  });
  assert.equal(assessment.allowed, true);
});
