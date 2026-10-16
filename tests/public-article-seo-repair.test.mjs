import test from "node:test";
import assert from "node:assert/strict";
import { cleanPublicExcerpt, cleanSeoTitle, selectSeoDescription } from "../lib/publicArticleRepair.js";

test("long SEO titles do not end on dangling connector words", () => {
  const title = "Fake Seeds and Seed Quality Regulation: Protecting Farmers and Agricultural Productivity";
  const cleaned = cleanSeoTitle(title, 68);
  assert.equal(cleaned, "Fake Seeds and Seed Quality Regulation: Protecting Farmers");
  assert.doesNotMatch(cleaned, /\s(?:and|or|the|of|for|to|in|with|from|on|at|by)$/i);
});

test("hard-clipped stored description is skipped in favor of the complete source summary", () => {
  const whyNews = "Green hydrogen is relevant to fertilisers, refining, steel, shipping fuels and selected storage uses where direct electrification is difficult. The issue is where renewable electricity delivers the greatest emissions reduction.";
  const stored = whyNews.slice(0, 160);
  const selected = selectSeoDescription([stored, whyNews], "National Green Hydrogen Mission", 160);
  assert.notEqual(selected, stored);
  assert.doesNotMatch(selected, /\bwhe$/i);
  assert.ok(selected.length <= 160);
});

test("Current Affairs card and SEO excerpts stop before embedded Markdown section headings", () => {
  const intro = "Reuters reported that India could face its steepest rice-output decline in nearly two decades after below-normal rainfall during crop maturation.";
  const raw = `${intro} ## TOP DATA & FACTS - Industry estimates indicated a fall of about 10 million tonnes. ## PRELIMS - Revise buffer norms.`;
  assert.equal(cleanPublicExcerpt(raw, "India’s Rice Output Risk", 260), intro);
  assert.equal(selectSeoDescription([raw], "India’s Rice Output Risk", 160), intro);
});
