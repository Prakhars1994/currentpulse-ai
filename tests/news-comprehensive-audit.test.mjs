import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  filterRelevantMapLocations,
} from "../lib/study/mapRelevance.js";

function load(path) {
  return fs.readFileSync(
    new URL(`../${path}`, import.meta.url),
    "utf8"
  );
}

test("News requires meaningful source depth before publication", () => {
  const fallback = load("lib/ai/trustedCoverageFallback.js");
  const quality = load("lib/news/newsOutputQuality.js");

  assert.match(fallback, /insufficient_news_depth/);
  assert.match(fallback, /points\.length < 7/);
  assert.match(fallback, /sourceWordCount < 120/);
  assert.match(quality, /byName\.lead\.length < 100/);
  assert.match(quality, /byName\.keyFacts\.length < 90/);
  assert.match(quality, /byName\.context\.length < 90/);
});

test("named locations can produce maps outside traditional geo categories", () => {
  const result = filterRelevantMapLocations({
    title: "Assam students affected after bridge damage",
    category: "Social Issues",
    text: "Students in Assam face travel disruption after a bridge was damaged.",
    mapLocations: ["Assam"],
  });

  assert.deepEqual(result, ["Assam"]);
});

test("News infers map locations before applying the relevance gate", () => {
  const visuals = load("components/ArticleStudyVisuals.jsx");
  const detail = load("app/news/[slug]/page.js");

  assert.match(visuals, /const inferred = inferLocations\(title, articleText\)/);
  assert.match(visuals, /mapLocations: candidates/);
  assert.doesNotMatch(detail, /MapMasteryPanel/);
  assert.match(detail, /newsFacts/);
  assert.match(detail, /newsContext/);
});

test("News pagination is path-based and materialized for Cloudflare", () => {
  const page = load("app/news/page.js");
  const archive = load("app/news/page/[page]/page.js");
  const materializer = load("scripts/materialize-static-reader.mjs");

  assert.match(page, /\/news\/page\/\$\{page\}/);
  assert.doesNotMatch(page, /\/news\?page=/);
  assert.match(archive, /NewsArchivePage/);
  assert.match(materializer, /STATIC_NEWS_ARCHIVE_PAGES/);
  assert.match(materializer, /\/news\/page\/\$\{page\}/);
});

test("News fetching is retryable and source pressure is bounded", () => {
  const rss = load("lib/news/rss.js");
  const route = load("app/api/auto-publish/route.js");
  const workflow = load(".github/workflows/currentpulse-background.yml");

  assert.match(rss, /RETRYABLE_RSS_STATUS/);
  assert.match(rss, /attempt <= 3/);
  assert.match(route, /NEWS_SOURCE_FETCH_CONCURRENCY/);
  assert.match(workflow, /NEWS_SOURCE_FETCH_CONCURRENCY: "2"/);
  assert.match(workflow, /NEWS_ENRICHMENT_DEADLINE_MS: "12000"/);
  assert.match(workflow, /newsBatchSize=4/);
  assert.match(workflow, /sleep 12/);
});

test("existing thin News has a deterministic repair lane", () => {
  const publisher = load("lib/publisher/publishArticle.js");
  const repair = load("app/api/news-quality-repair/route.js");
  const workflow = load(".github/workflows/currentpulse-background.yml");

  assert.match(publisher, /rebuildPublishedNewsArticle/);
  assert.match(repair, /rebuildPublishedNewsArticle/);
  assert.match(workflow, /news-repair\)/);
  assert.match(workflow, /news-quality-repair\?apply=1/);
});

test("News chronology uses the retained source publication timestamp", () => {
  const publisher = load("lib/publisher/publishArticle.js");
  assert.match(publisher, /newsCreatedAt/);
  assert.match(
    publisher,
    /created_at: newsCreatedAt\(sourceItem, generationMode, now\)/
  );
});
