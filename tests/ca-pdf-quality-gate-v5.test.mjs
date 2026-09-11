import test from "node:test";
import assert from "node:assert/strict";
import { auditCaPdfLiveArticle, CA_PDF_LIVE_QUALITY_GATE_VERSION } from "../lib/pdf/liveQualityGate.js";

function buildArticle({ facts = 6, prelims = 3, mainsWords = 300, sourceUrl = true } = {}) {
  const factLines = Array.from({ length: facts }, (_, i) => `- Verified data point ${i + 1} with exam relevance and a concrete policy implication.`).join("\n");
  const prelimLines = Array.from({ length: prelims }, (_, i) => `- Prelims fact ${i + 1}: institution, mechanism and scope are clearly distinguished.`).join("\n");
  const analyticalWords = Array.from({ length: mainsWords }, (_, i) => `w${i + 1}`).join(" ");
  return `## FAST READ\n- Concise verified current update.\n\n## WHY IN NEWS\nThe issue is currently relevant and grounded in an official development.\n\n## TOP DATA & FACTS\n${factLines}\n\n## PRELIMS\n${prelimLines}\n\n## QUICK REVISION\nThis revision block deliberately contains enough substance to recall the institution, mechanism, significance, limitation and examination linkage without filler.\n\n## PROBABLE OBJECTIVE QUESTION\n1. Statement one.\n2. Statement two.\n(a) 1 only\n(b) 2 only\n(c) Both 1 and 2\n(d) Neither 1 nor 2\nAnswer: (c)\nExplanation: Both statements follow from the verified facts.\n\n[Ask CurrentPulse AI: Prelims](https://cp.vliab.workers.dev/ai)\n\n## PROBABLE MAINS QUESTION\nDiscuss the significance and implementation challenges.\n\n## MODEL ANSWER (~300 WORDS)\n### INTRODUCTION\n${analyticalWords}\n\n### SIGNIFICANCE\nEvidence-based significance for governance and public outcomes.\n\n### IMPLEMENTATION CHALLENGES\nInstitutional capacity, coordination and measurable delivery remain central.\n\n### WAY FORWARD\nUse accountable implementation, measurable indicators and transparent review.\n\n### CONCLUSION\nThe policy should combine credible evidence with effective implementation.\n\n[Ask CurrentPulse AI: Mains](https://cp.vliab.workers.dev/ai)\n\n## SOURCES\n- PIB / Government of India official release${sourceUrl ? ": https://www.pib.gov.in/example" : "."}`;
}

test("CA PDF quality gate v6 matches the canonical CurrentPulse editorial contract", () => {
  assert.equal(CA_PDF_LIVE_QUALITY_GATE_VERSION, 6);
  const audit = auditCaPdfLiveArticle(buildArticle({ facts: 6, prelims: 3, mainsWords: 300 }));
  assert.equal(audit.ok, true, audit.problems.join("; "));
  assert.equal(audit.metrics.factsBullets, 6);
  assert.equal(audit.metrics.prelimsBullets, 3);
});

test("about-300-word answers near the upper bound are accepted", () => {
  const audit = auditCaPdfLiveArticle(buildArticle({ mainsWords: 335 }));
  assert.equal(audit.ok, true, audit.problems.join("; "));
  assert.ok(audit.metrics.mainsWords <= 380);
});

test("historical dash labels are normalized before quality checks", () => {
  const text = buildArticle().replace("MODEL ANSWER (~300 WORDS)", "MODEL ANSWER - ~300 WORDS").replace("Ask CurrentPulse AI: Prelims", "Ask CurrentPulse AI - Prelims").replace("Ask CurrentPulse AI: Mains", "Ask CurrentPulse AI - Mains");
  const audit = auditCaPdfLiveArticle(text);
  assert.equal(audit.ok, true, audit.problems.join("; "));
});

test("the gate still rejects genuinely thin Prelims content", () => {
  const audit = auditCaPdfLiveArticle(buildArticle({ prelims: 2 }));
  assert.equal(audit.ok, false);
  assert.ok(audit.problems.some((problem) => problem.includes("PRELIMS needs at least 3")));
});

test("official sources require a clickable URL", () => {
  const audit = auditCaPdfLiveArticle(buildArticle({ sourceUrl: false }));
  assert.equal(audit.ok, false);
  assert.ok(audit.problems.includes("Official source must include a clickable URL"));
});

test("FAST READ and WHY IN NEWS cannot be exact editorial duplicates", () => {
  const repeated = "- The same verified current-affairs development is repeated here with the same institution, date, policy significance, implementation context and examination relevance.\n- This second bullet is deliberately identical across both sections so the regression fixture is long enough to exercise duplicate detection.";
  const base = buildArticle();
  const duplicated = base
    .replace(/## FAST READ[\s\S]*?## WHY IN NEWS/, `## FAST READ\n${repeated}\n\n## WHY IN NEWS`)
    .replace(/## WHY IN NEWS[\s\S]*?## TOP DATA & FACTS/, `## WHY IN NEWS\n${repeated}\n\n## TOP DATA & FACTS`);
  const audit = auditCaPdfLiveArticle(duplicated);
  assert.equal(audit.ok, false);
  assert.ok(audit.problems.includes("FAST READ and WHY IN NEWS must not duplicate each other"));
});
