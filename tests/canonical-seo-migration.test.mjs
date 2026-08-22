import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("canonical host is strictly https://cp.vliab.workers.dev across site configuration", () => {
  const siteUrlModule = read("lib/siteUrl.js");
  assert.match(siteUrlModule, /https:\/\/cp\.vliab\.workers\.dev/);
  assert.doesNotMatch(siteUrlModule, /currentpulse-ai\.vercel\.app/);
});

test("robots.txt declares canonical host and canonical sitemaps", () => {
  const robots = read("app/robots.ts");
  assert.match(robots, /SITE_URL/);
  assert.match(robots, /\/sitemap\.xml/);
  assert.match(robots, /\/news-sitemap\.xml/);
  assert.match(robots, /host:\s*SITE_URL/);
});

test("RSS feed declares canonical host links", () => {
  const feed = read("public/feed.xml");
  assert.match(feed, /<link>https:\/\/cp\.vliab\.workers\.dev\/<\/link>/);
  assert.match(feed, /https:\/\/cp\.vliab\.workers\.dev\/current-affairs/);
  assert.match(feed, /https:\/\/cp\.vliab\.workers\.dev\/news/);
  assert.match(feed, /https:\/\/cp\.vliab\.workers\.dev\/exams/);
  assert.match(feed, /https:\/\/cp\.vliab\.workers\.dev\/quiz/);
  assert.doesNotMatch(feed, /vercel\.app/);
});

test("vercel.json contains permanent 308 host-level redirects for legacy domains and does not redirect canonical host", () => {
  const config = JSON.parse(read("vercel.json"));
  assert.equal(Array.isArray(config.redirects), true);

  const legacyHostRules = config.redirects.filter((rule) =>
    rule.has?.some((h) =>
      h.type === "host" &&
      (h.value === "currentpulse-ai.vercel.app" || h.value === "currentpulse-ai-kl7x.vercel.app")
    )
  );

  assert.equal(legacyHostRules.length, 2);
  for (const rule of legacyHostRules) {
    assert.equal(rule.source, "/(.*)");
    assert.equal(rule.destination, "https://cp.vliab.workers.dev/$1");
    assert.equal(rule.permanent, true);
  }

  // Canonical host must never be redirected
  const canonicalRedirect = config.redirects.find((rule) =>
    rule.has?.some((h) => h.value === "cp.vliab.workers.dev")
  );
  assert.equal(canonicalRedirect, undefined);
});

test("middleware is strictly scoped to /admin and does not intercept public routes", () => {
  const middleware = read("middleware.ts");
  assert.match(middleware, /matcher:\s*\[\s*["']\/admin\/:path\*["']\s*\]/);
  assert.doesNotMatch(middleware, /matcher:\s*\[\s*["']\/\(\(\?!/);
});

test("ResultPulse User-Agent uses canonical host", () => {
  const collector = read("lib/exams/collector.js");
  assert.match(collector, /\+https:\/\/cp\.vliab\.workers\.dev\/exams/);
  assert.doesNotMatch(collector, /currentpulse-ai\.vercel\.app/);
});
test("sitemaps only expose rows that pass the same public stream gates", () => {
  const sitemap = read("app/sitemap.ts");
  const newsSitemap = read("app/news-sitemap.xml/route.js");
  assert.match(sitemap, /isPublicNewsArticle/);
  assert.match(sitemap, /isCurrentAffairsReady/);
  assert.match(newsSitemap, /isPublicNewsArticle/);
  assert.match(newsSitemap, /if \(!isPublicNewsArticle\(article\)\) continue/);
});
