import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

function load(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const background = load(".github/workflows/currentpulse-background.yml");
const maintenance = load(".github/workflows/currentpulse-quality-maintenance.yml");
const production = load(".github/workflows/currentpulse-production.yml");
const readerRelease = load(".github/workflows/currentpulse-reader-release.yml");
const history = load(".github/workflows/currentpulse-history-repair.yml");
const releasePaths = load("scripts/public-release-paths.mjs");

test("scheduled background work is ResultPulse-only", () => {
  assert.match(background, /workflow_dispatch:/);
  assert.match(background, /\n\s+schedule:/);

  for (const utcHour of [1, 7, 14, 17]) {
    assert.match(background, new RegExp(`0 ${utcHour} \\* \\* \\*`));
  }

  for (const removedHour of [4, 10, 18]) {
    assert.doesNotMatch(background, new RegExp(`0 ${removedHour} \\* \\* \\*`));
  }

  assert.match(background, /\/api\/exams\/run\?notifications=0&runner=github/);
  assert.doesNotMatch(background, /\/api\/coverage-import/);
  assert.doesNotMatch(background, /\/api\/auto-publish/);
  assert.doesNotMatch(background, /\/api\/process-queue/);
  assert.doesNotMatch(background, /news-quality-repair/);
  assert.doesNotMatch(background, /quality-repair/);
  assert.doesNotMatch(background, /editorial-cleanup/);
  assert.doesNotMatch(background, /GEMINI_API_KEY|OPENROUTER_API_KEY|GROQ_API_KEY|MISTRAL_API_KEY/);
  assert.doesNotMatch(maintenance, /\n\s+schedule:/);
});

test("background and maintenance release public changes through the reader workflow", () => {
  for (const workflow of [background, maintenance, history]) {
    assert.match(workflow, /public-release-state\.mjs/);
    assert.match(workflow, /currentpulse-reader-release\.yml/);
    assert.doesNotMatch(workflow, /wrangler deploy/);
    assert.doesNotMatch(workflow, /opennextjs-cloudflare build/);
  }

  assert.match(readerRelease, /materialize-static-reader\.mjs/);
  assert.match(readerRelease, /public-release-paths\.mjs/);
  assert.match(readerRelease, /currentpulse-static-reader-manifest\.json/);
  assert.match(readerRelease, /--changed-file/);
  assert.match(readerRelease, /mode=incremental/);
  assert.match(readerRelease, /mode=full/);
  assert.match(readerRelease, /wrangler deploy/);
  assert.match(readerRelease, /actions\/cache\/restore@v4/);
  assert.match(readerRelease, /reuse-local/);
  assert.match(readerRelease, /cancel-in-progress: false/);
  assert.match(readerRelease, /reader_release_requests/);
});

test("incremental reader planning is bounded and refreshes exact stream paths", () => {
  assert.match(releasePaths, /article_sources/);
  assert.match(releasePaths, /source_kind/);
  assert.match(releasePaths, /paths\.add\("\/news"\)/);
  assert.doesNotMatch(releasePaths, /\/news\/page\/\$\{page\}/);
  assert.match(releasePaths, /\/current-affairs\/\$\{article\.slug\}/);
  assert.match(releasePaths, /\/exams\/\$\{exam\.slug\}/);
  assert.match(releasePaths, /\/quiz/);
  assert.match(releasePaths, /FULL_RELEASE_REQUIRED/);
  assert.match(releasePaths, /changed-row count exceeded safe incremental limit/);
});

test("production workflow validates code then materializes the Cloudflare reader", () => {
  assert.match(production, /opennextjs-cloudflare build/);
  assert.match(production, /materialize-static-reader\.mjs/);
  assert.match(production, /wrangler deploy/);
  assert.doesNotMatch(production, /opennextjs-cloudflare deploy/);
  assert.match(production, /Production smoke test/);
  assert.match(production, /CLOUDFLARE_API_TOKEN/);
  assert.match(production, /Save validated release snapshot/);
});
