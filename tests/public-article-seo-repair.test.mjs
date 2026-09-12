import test from "node:test";
import assert from "node:assert/strict";
import { cleanSeoTitle, selectSeoDescription } from "../lib/publicArticleRepair.js";

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
