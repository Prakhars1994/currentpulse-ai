import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("routine background does not rebuild or deploy the whole reader", () => {
  const background = read(".github/workflows/currentpulse-background.yml");
  assert.doesNotMatch(background, /opennextjs-cloudflare build|wrangler deploy/);
  assert.match(background, /public-release-state\.mjs/);
});

test("reader release restores validated Cloudflare build", () => {
  const release = read(".github/workflows/currentpulse-reader-release.yml");
  assert.match(release, /actions\/cache\/restore@v4/);
  assert.match(release, /--reuse-local/);
});

test("manual PDF publisher requests the common reader release", () => {
  const publisher = read("app/api/admin/pdf-import/publish/route.js");
  const background = read(".github/workflows/currentpulse-background.yml");
  assert.match(publisher, /requestReaderRelease/);
  assert.doesNotMatch(background, /news-release\)|drain_queue|auto-publish|coverage-import/);
});
