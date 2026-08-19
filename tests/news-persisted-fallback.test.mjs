import test from "node:test";
import assert from "node:assert/strict";

import { assessNewsOutputQuality } from "../lib/news/newsOutputQuality.js";

const repeated =
  "Assam students are struggling to reach school after a damaged bridge created a serious accident risk for children and local residents.";

const content =
  "CURRENT_PULSE_NEWS_V1:" +
  JSON.stringify({
    version: 1,
    title: "Bridge damage affects students in Assam",
    lead: repeated,
    keyFacts: repeated,
    context: repeated,
    whyItMatters:
      "The disruption affects school access, local mobility and public safety.",
    visualSummary: "",
  });

test("persisted deterministic News fallback retains overlap exemption", () => {
  const result = assessNewsOutputQuality({
    content,
    quality_flags: ["source_grounded_news_fallback"],
  });

  assert.equal(result.allowed, true);
});

test("ordinary duplicated News still remains blocked", () => {
  const result = assessNewsOutputQuality({ content });

  assert.equal(result.allowed, false);
  assert.equal(result.code, "duplicated_news_sections");
});
