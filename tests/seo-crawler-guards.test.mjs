import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { assessExamSitemapRecord, examDisplayTitle } from "../lib/sitemapQuality.js";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const baseExamRow = {
  slug: "uppsc-qualified-candidates-example-12345678",
  official_url: "https://uppsc.up.nic.in/example.pdf",
  source_name: "UPPSC",
};

test("future listing-date prefixes cannot make results look current", () => {
  const assessment = assessExamSitemapRecord({
    ...baseExamRow,
    title: "09 Oct 2099 LIST OF CANDIDATES PROVISIONALLY QUALIFIED FOR MAINS",
    update_type: "result",
  });
  assert.equal(assessment.allowed, false);
  assert.equal(assessment.code, "future_listing_date");
});

test("future event dates remain allowed for genuine exam scheduling", () => {
  const assessment = assessExamSitemapRecord({
    ...baseExamRow,
    title: "09 Oct 2099 Examination Schedule for Combined State Examination",
    update_type: "exam-date",
  });
  assert.equal(assessment.allowed, true);
});

test("display titles strip official-list date prefixes", () => {
  assert.equal(
    examDisplayTitle("09 Oct 2025 LIST OF CANDIDATES PROVISIONALLY QUALIFIED FOR MAINS"),
    "LIST OF CANDIDATES PROVISIONALLY QUALIFIED FOR MAINS"
  );
});

test("Notes sends an HTTP noindex directive in addition to page metadata", () => {
  const config = read("next.config.ts");
  const notes = read("app/notes/page.js");
  assert.match(config, /source:\s*['"]\/notes['"]/);
  assert.match(config, /X-Robots-Tag/);
  assert.match(config, /noindex, follow/);
  assert.match(notes, /robots:\s*\{\s*index:\s*false,\s*follow:\s*true\s*\}/);
});

test("ResultPulse repository changes have bounded reader impact", () => {
  const planner = read("scripts/code-release-paths.mjs");
  assert.match(planner, /file === "lib\/exams\/repository\.js"/);
  assert.match(planner, /paths\.add\("\/exams"\)/);
});
