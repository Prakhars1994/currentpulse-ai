import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { filterRelevantMapLocations } from "../lib/study/mapRelevance.js";

const load = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("named locations can produce maps outside traditional geo categories", () => {
  assert.deepEqual(filterRelevantMapLocations({ title: "Assam bridge damage", category: "Social Issues", text: "Students in Assam face disruption.", mapLocations: ["Assam"] }), ["Assam"]);
});

test("News pagination remains path-based and materialized for Cloudflare", () => {
  const page = load("app/news/page.js");
  const materializer = load("scripts/materialize-static-reader.mjs");
  assert.match(page, /\/news\/page\/\$\{page\}/);
  assert.doesNotMatch(page, /\/news\?page=/);
  assert.match(materializer, /STATIC_NEWS_ARCHIVE_PAGES/);
});

test("scheduled background does not fetch or repair News", () => {
  const workflow = load(".github/workflows/currentpulse-background.yml");
  assert.doesNotMatch(workflow, /NEWS_SOURCE_FETCH_CONCURRENCY|NEWS_ENRICHMENT_DEADLINE_MS|news-repair|news-quality-repair|auto-publish/);
});

test("legacy News repair can never mutate admin-protected PDF articles", () => {
  const repair = load("app/api/news-quality-repair/route.js");
  assert.match(repair, /\.eq\("manual_protected", false\)/);
});
