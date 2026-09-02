import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

function load(relative) { return fs.readFileSync(new URL(`../${relative}`, import.meta.url), "utf8"); }
async function loadResolver() {
  const deadlineUrl = pathToFileURL(path.resolve(process.cwd(), "lib/network/deadline.js")).href;
  const source = load("lib/news/governmentImageResolver.js").replace('"@/lib/network/deadline"', JSON.stringify(deadlineUrl));
  const temp = path.resolve(process.cwd(), "tests/.tmp-government-image-resolver.mjs");
  fs.writeFileSync(temp, source, "utf8");
  return { resolver: await import(`${pathToFileURL(temp).href}?v=${Date.now()}`), cleanup: () => fs.rmSync(temp, { force: true }) };
}

test("image resolver keeps deterministic priority while capping a miss at two requests", async () => {
  const { resolver, cleanup } = await loadResolver();
  try {
    assert.deepEqual(resolver.governmentImageProviderPriority("Space"), ["isro", "nasa"]);
    assert.deepEqual(resolver.governmentImageProviderPriority("Environment"), ["noaa", "usgs", "nasa"]);
    let calls = 0;
    const result = await resolver.resolveGovernmentArticleImage(
      { title: "Example cyclone", category: "Environment" },
      { fetch: async (url) => { calls += 1; if (String(url).includes("commons.wikimedia.org")) return { ok: true, json: async () => ({ query: { pages: {} } }) }; return { ok: true, json: async () => ({ collection: { items: [] } }) }; } }
    );
    assert.equal(calls, 2);
    assert.equal(result.resolution.status, "no_safe_image");
    assert.equal(result.resolution.requests_used, 2);
    assert.equal(result.resolution.provider, "noaa");
  } finally { cleanup(); }
});

test("terminal resolver state prevents any repeat request", async () => {
  const { resolver, cleanup } = await loadResolver();
  try {
    const previous = { status: "no_safe_image", provider: "pib", requests_used: 1 };
    const result = await resolver.resolveGovernmentArticleImage({ title: "Policy", category: "Government policy", image_resolution: previous }, { fetch: async () => { throw new Error("must not fetch"); } });
    assert.equal(result.searched, false); assert.equal(result.resolution, previous);
  } finally { cleanup(); }
});

test("publication, admin PDF import and explicit backfill share one resolve-once image policy", () => {
  const publisher = load("lib/publisher/publishArticle.js");
  const pdfPublisher = load("app/api/admin/pdf-import/publish/route.js");
  const backfill = load("app/api/backfill-images/route.js");
  const publicPage = load("app/news/[slug]/page.js");
  const migration = load("supabase/migrations/20260824112805_article_image_resolution.sql");
  assert.match(publisher, /resolveGovernmentArticleImage/);
  assert.match(pdfPublisher, /resolveGovernmentArticleImage/);
  assert.match(pdfPublisher, /image_resolution/);
  assert.match(backfill, /resolveGovernmentArticleImage/);
  assert.match(backfill, /isTerminalImageResolution/);
  assert.match(backfill, /hotlink/);
  assert.match(publicPage, /\.select\("\*,article_sources/);
  assert.match(migration, /add column if not exists image_resolution jsonb/);
});
