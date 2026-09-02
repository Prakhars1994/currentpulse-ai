import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildSourceGroundedNewsFallback } from "../lib/ai/trustedCoverageFallback.js";
import { assessNewsEditorialValue } from "../lib/news/newsEditorialGate.js";

function load(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("News fallback measures real whitespace and produces rendered sections", () => {
  const source = [
    "The Union government announced in New Delhi that the next national population exercise will use a digitally supported household enumeration process across India.",
    "Officials said the programme will retain field verification while introducing mobile data capture designed to reduce transcription delays and improve monitoring.",
    "The exercise will collect standard demographic information through notified schedules and trained enumerators working under the existing legal and administrative framework.",
    "State and district authorities will coordinate field operations, local logistics, staff deployment and public communication during the different enumeration phases.",
    "The government said data security, identity protection and controlled access will remain central requirements throughout collection, transmission, storage and processing.",
    "Updated population information supports planning for welfare delivery, infrastructure, health, education, urban development and the allocation of public resources.",
    "Researchers and administrators use census tables to compare demographic change across regions and to assess migration, age structure, literacy and workforce trends.",
    "The new digital workflow may improve the speed of compilation, but it will also require strong offline procedures where connectivity is weak.",
    "The quality of the final dataset will depend on training, consistent definitions, coverage of difficult locations and effective correction of field errors.",
    "Public confidence is important because households must understand what information is being collected, why it is required and how confidentiality will be protected."
  ].join(" ");

  const brief = buildSourceGroundedNewsFallback(
    `COMPLETE EXTRACTED SOURCE CONTENT\n\n${source}`,
    {
      sourceTitle: "Government announces digitally supported population enumeration",
      sourceCategory: "Polity & Governance",
      sourcePaper: "Prelims",
    }
  );

  assert.ok(brief.quality.metrics.sourceWords >= 120);
  assert.equal(brief.quality.metrics.factualPoints, 3);
  assert.equal(brief.quality.metrics.contextPoints, 2);
  assert.match(brief.static_foundation, /Essential context/);
  assert.match(brief.data_examples, /Verified facts from the source/);
  assert.equal(brief.static_foundation.includes("\\n"), false);
  assert.equal(brief.data_examples.includes("\\n"), false);
  assert.ok(brief.map_locations.includes("New Delhi"));
});

test("deterministic News gate removes obvious junk without narrowing public affairs", () => {
  assert.equal(assessNewsEditorialValue({ title: "Cardiologist shares 5 healthy heart habits she never ignores", url: "https://example.com/lifestyle/heart-habits" }).allowed, false);
  assert.equal(assessNewsEditorialValue({ title: "Today's ePaper digital edition", url: "https://example.com/epaper/today" }).allowed, false);
  assert.equal(assessNewsEditorialValue({ title: "Stocks to buy today: brokerage gives five share price targets", url: "https://example.com/markets/stocks-to-buy" }).allowed, false);
  assert.equal(assessNewsEditorialValue({ title: "Supreme Court directs Union government to file response on data protection rules", description: "The court asked the ministry to respond before the next hearing.", url: "https://example.com/india/supreme-court-data-protection" }).allowed, true);
  assert.equal(assessNewsEditorialValue({ title: "Iran and Oman work to finalise Strait of Hormuz shipping agreement", description: "Officials discussed an agreement affecting regional shipping and diplomacy.", url: "https://example.com/world/hormuz-agreement" }).allowed, true);
});

test("legacy auto-publish cannot collect, evaluate or publish anything", () => {
  const route = load("app/api/auto-publish/route.js");
  assert.match(route, /manual_publishing_only/);
  assert.match(route, /status:\s*410/);
  assert.doesNotMatch(route, /assessNewsEditorialValue|fetchSourceRss|publishArticle|queueCoverageImport/);
});
