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

  // The ordinary News mode must stay direct-publish and queue-free.
  // A separate one-time news-release maintenance mode is allowed to drain
  // legacy Supabase News rows created by the old architecture.
  const normalNewsBlock =
    background.match(/\n\s+news\)\n([\s\S]*?)\n\s+;;/)?.[1] || "";
  assert.doesNotMatch(
    normalNewsBlock,
    /drain_queue\s+\d+\s+news/
  );
  assert.match(background, /news-release\)/);
  assert.match(background, /drain_queue 2700 news 220/);

  assert.match(background, /news-catchup\)/);
  assert.match(background, /newsBatch=\$\{news_batch\}/);
  assert.match(background, /for news_batch in 0 1 2 3 4 5 6; do/);

  // Current Affairs must retain its retry queue.
  assert.match(background, /drain_queue 300 coverage/);
});
