import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("legacy News recovery cannot reference an undefined coaching constant", () => {
  const processor = read("app/api/process-queue/route.js");
  assert.doesNotMatch(processor, /COACHING_PIPELINES/);
  assert.match(processor, /\.filter\(\(row\) => !isCoverageQueueItem\(row\)\)/);
});

test("one-time News release fails loudly on queue/runtime errors", () => {
  const workflow = read(".github/workflows/currentpulse-background.yml");
  assert.match(workflow, /local strict_errors="\$\{4:-false\}"/);
  assert.match(workflow, /drain_queue 2700 news 220 true/);
  assert.match(
    workflow,
    /if \[\[ "\$\{strict_errors\}" == "true" \]\]; then\s+return 1/
  );

  const releaseBlock =
    workflow.match(/news-release\)([\s\S]*?)\n\s+;;/)?.[1] || "";

  assert.doesNotMatch(releaseBlock, /news-backlog-status\.mjs \|\| true/);
  assert.match(
    releaseBlock,
    /Published News repair request failed;[\s\S]*?\n\s+false/
  );
});

test("normal News mode is queue-free and legacy auto-News is explicitly disabled", () => {
  const workflow = read(".github/workflows/currentpulse-background.yml");
  const route = read("app/api/auto-publish/route.js");
  const normalNewsBlock =
    workflow.match(/\r?\n\s+news\)\r?\n([\s\S]*?)\r?\n\s+;;/)?.[1] || "";

  assert.match(normalNewsBlock, /auto-publish/);
  assert.doesNotMatch(normalNewsBlock, /drain_queue/);
  assert.match(workflow, /AUTOMATED_NEWS_ENABLED:\s*"false"/);
  assert.match(route, /process\.env\.AUTOMATED_NEWS_ENABLED \|\| "false"/);
});