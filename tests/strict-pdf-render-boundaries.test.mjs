import test from "node:test";
import assert from "node:assert/strict";
import { repairCanonicalPdfMarkdown } from "../lib/study/highlightFacts.js";

test("strict PDF headings never remain inside bullet text", () => {
  const input = `## FAST READ\n- Fact one. ## PRELIMS\n- Prelim fact.\n## PROBABLE OBJECTIVE QUESTION\n1. First statement.\n2. Second statement.\n3. Third statement. Which of the statements given above is/are correct?\n(a) 1 only\n(b) 2 only\n(c) 1 and 2 only\n(d) 1, 2 and 3\n## MODEL ANSWER (~300 WORDS)\n### INTRODUCTION\nIntro text.\n- Benefit. ### CHALLENGES\n- Risk. ### ACTIONABLE ROADMAP\n- Reform. ### FINAL TAKEAWAY\nConclusion.\n[Ask CurrentPulse AI: Mains](https://cp.vliab.workers.dev/ai) ## VERIFIED OFFICIAL REFERENCES\n- Official source: PIB - https://pib.gov.in/example`;
  const output = repairCanonicalPdfMarkdown(input);

  assert.match(output, /Fact one\.\n\n## PRELIMS/);
  assert.match(output, /Benefit\.\n\n### CHALLENGES/);
  assert.match(output, /Risk\.\n\n### ACTIONABLE ROADMAP/);
  assert.match(output, /Reform\.\n\n### FINAL TAKEAWAY/);
  assert.match(output, /Third statement\.\n\nWhich of the statements/);
  assert.match(output, /\n\n\(a\) 1 only\n\n\(b\) 2 only/);
  assert.match(output, /Ask CurrentPulse AI: Mains[^\n]+\n\n## VERIFIED OFFICIAL REFERENCES/);
  assert.doesNotMatch(output, /- [^\n]+\s#{2,4}\s/);
});
