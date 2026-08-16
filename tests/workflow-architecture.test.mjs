import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

function load(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const background = load(".github/workflows/currentpulse-background.yml");
const maintenance = load(".github/workflows/currentpulse-quality-maintenance.yml");
const production = load(".github/workflows/currentpulse-production.yml");

test("scheduled collectors are not duplicated in GitHub background workflow", () => {
  assert.match(background, /workflow_dispatch:/);
  assert.doesNotMatch(background, /\n\s+schedule:/);
  assert.doesNotMatch(background, /AUTOMATION_ENABLED/);
});

test("data workflows never redeploy application code", () => {
  assert.doesNotMatch(background, /npm run deploy|opennextjs-cloudflare deploy|wrangler deploy/);
  assert.doesNotMatch(maintenance, /npm run deploy|opennextjs-cloudflare deploy|wrangler deploy/);
});

test("production workflow owns validated code deployment", () => {
  assert.match(production, /opennextjs-cloudflare build/);
  assert.match(production, /opennextjs-cloudflare deploy/);
  assert.match(production, /Production smoke test/);
  assert.match(production, /CLOUDFLARE_API_TOKEN/);
});
