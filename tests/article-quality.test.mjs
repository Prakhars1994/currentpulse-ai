import test from "node:test";
import assert from "node:assert/strict";
import { assessArticleQuality } from "../lib/ai/articleQuality.js";

function baseArticle() {
  const bullet = (label, extra = "") => `- **${label}**: verified institutional context, implementation detail, consequence and exam relevance ${extra}.`;
  return {
    why_news: "A recent official development created a clear UPSC-relevant policy trigger with verified institutional context and consequences.",
    syllabus_linkage: "GS-2: governance and public policy; Prelims: institutions and statutory framework.",
    india_relevance: "The development affects implementation, accountability and public-service delivery in India.",
    static_foundation: Array.from({ length: 7 }, (_, i) => bullet(`Static ${i + 1}`, "constitutional institutional administrative federal legal")).join("\n"),
    data_examples: [
      "- **2026**: official implementation milestone reported by the responsible institution.",
      "- **75%**: illustrative verified coverage figure used for exam-oriented evidence.",
      "- **Report**: an official report explains implementation outcomes and constraints.",
      "- **Committee**: institutional review identified accountability gaps and reforms.",
      "- **Act**: the governing statutory framework defines powers and responsibilities.",
      "- **Article**: constitutional context connects the current development to static polity.",
    ].join("\n"),
    prelims: Array.from({ length: 5 }, (_, i) => bullet(`Prelims ${i + 1}`, "scope authority legal-status distinction exception" )).join("\n"),
    mains: Array.from({ length: 12 }, (_, i) => bullet(`Mains ${i + 1}`, `dimension-${i} challenge reform stakeholder outcome evidence`)).join("\n"),
    answer_framework: Array.from({ length: 7 }, (_, i) => bullet(`Framework ${i + 1}`, `intro body-${i} argument example counterpoint conclusion`)).join("\n"),
  };
}

test("raw AI key-value residue fails the publication-quality gate", () => {
  const article = baseArticle();
  article.data_examples += "\ndata: year: 79 years\neconomic_benefit: potentially bring economic benefits";
  const result = assessArticleQuality(article);
  assert.equal(result.passed, false);
  assert.ok(result.flags.includes("editorial_residue"));
});

test("copy-pasted study sections are detected", () => {
  const article = baseArticle();
  article.prelims = article.static_foundation;
  article.data_examples = article.static_foundation;
  const result = assessArticleQuality(article);
  assert.equal(result.passed, false);
  assert.ok(result.flags.includes("repetitive_sections"));
});

test("source-grounded CA fallbacks are not failed for intentional section reuse alone", () => {
  const article = baseArticle();
  article.prelims = article.static_foundation;
  article.data_examples = article.static_foundation;
  article.quality_flags = ["source_grounded_fallback"];
  const result = assessArticleQuality(article);
  assert.equal(result.flags.includes("repetitive_sections"), false);
});
