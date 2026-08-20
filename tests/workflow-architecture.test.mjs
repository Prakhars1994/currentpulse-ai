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

test("GitHub background workflow is the single scheduled heavy automation owner", () => {
  assert.match(background, /workflow_dispatch:/);
  assert.match(background, /\n\s+schedule:/);
  assert.match(background, /0 1,4,7,10,14,17,18 \* \* \*/);
  assert.doesNotMatch(background, /AUTOMATION_ENABLED/);
  assert.doesNotMatch(maintenance, /\n\s+schedule:/);
});

test("content workflows dispatch one incremental reader release only after data changes", () => {
  for (const workflow of [background, maintenance, history]) {
    assert.match(workflow, /public-release-state\.mjs/);
    assert.match(workflow, /currentpulse-reader-release\.yml/);
    assert.doesNotMatch(workflow, /wrangler deploy/);
    assert.doesNotMatch(workflow, /opennextjs-cloudflare build/);
  }
  assert.match(readerRelease, /materialize-static-reader\.mjs/);
  assert.match(readerRelease, /wrangler deploy/);
  assert.match(readerRelease, /actions\/cache\/restore@v4/);
  assert.match(readerRelease, /reuse-local/);
});

test("production workflow validates code then materializes the same static reader architecture", () => {
  assert.match(production, /opennextjs-cloudflare build/);
  assert.match(production, /materialize-static-reader\.mjs/);
  assert.match(production, /wrangler deploy/);
  assert.doesNotMatch(production, /opennextjs-cloudflare deploy/);
  assert.match(production, /Production smoke test/);
  assert.match(production, /CLOUDFLARE_API_TOKEN/);
  assert.match(production, /Save validated release snapshot/);
});
