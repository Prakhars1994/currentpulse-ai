import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

function load(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const background = load(".github/workflows/currentpulse-background.yml");
const maintenance = load(".github/workflows/currentpulse-quality-maintenance.yml");
const production = load(".github/workflows/currentpulse-production.yml");

test("GitHub background workflow is the single scheduled heavy automation owner", () => {
  assert.match(background, /workflow_dispatch:/);
  assert.match(background, /\n\s+schedule:/);
  assert.match(background, /0 1,4,7,10,14,17,18 \* \* \*/);
  assert.doesNotMatch(background, /AUTOMATION_ENABLED/);
  assert.doesNotMatch(maintenance, /\n\s+schedule:/);
});

test("content workflow publishes a static reader snapshot instead of relying on live SSR", () => {
  assert.match(background, /materialize-static-reader\.mjs/);
  assert.match(background, /wrangler deploy/);
  assert.doesNotMatch(background, /opennextjs-cloudflare deploy/);
});

test("production workflow validates code then materializes the same static reader architecture", () => {
  assert.match(production, /opennextjs-cloudflare build/);
  assert.match(production, /materialize-static-reader\.mjs/);
  assert.match(production, /wrangler deploy/);
  assert.doesNotMatch(production, /opennextjs-cloudflare deploy/);
  assert.match(production, /Production smoke test/);
  assert.match(production, /CLOUDFLARE_API_TOKEN/);
});
