import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

function load(path) {
  return fs.readFileSync(
    new URL(`../${path}`, import.meta.url),
    "utf8"
  );
}

const autoPublish =
  load("app/api/auto-publish/route.js");

const background =
  load(".github/workflows/currentpulse-background.yml");

test("accepted News publishes directly without article_queue", () => {
  assert.match(autoPublish, /publishCandidatesDirectly/);
  assert.match(
    autoPublish,
    /const directResults = await publishCandidatesDirectly/
  );
  assert.match(
    autoPublish,
    /publishArticle\(supabase, sourceItem\)/
  );

  assert.doesNotMatch(autoPublish, /queueCandidate/);
  assert.doesNotMatch(
    autoPublish,
    /NEWS_MAX_QUEUE_WRITES_PER_RUN/
  );
  assert.doesNotMatch(autoPublish, /const queueBatch =/);
});

test("normal News automation no longer drains a News queue", () => {
  assert.match(background, /NEWS_PUBLISH_CONCURRENCY/);
  assert.match(background, /NEWS_ENRICHMENT_DEADLINE_MS/);
  assert.doesNotMatch(
    background,
    /drain_queue\s+\d+\s+news/
  );

  assert.match(background, /news-catchup\)/);
  assert.match(background, /newsBatch=\$\{news_batch\}/);
  assert.match(background, /for news_batch in 0 1 2 3; do/);

  // Current Affairs must retain its retry queue.
  assert.match(background, /drain_queue 300 coverage/);
});
