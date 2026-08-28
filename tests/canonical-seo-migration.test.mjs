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

test("robots.txt declares canonical host and only the active canonical sitemap", () => {
  const robots = read("app/robots.ts");
  assert.match(robots, /SITE_URL/);
  assert.match(robots, /\/sitemap\.xml/);
  assert.doesNotMatch(robots, /\/news-sitemap\.xml/);
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

test("Vercel deployment configuration and runtime analytics are absent", () => {
  assert.equal(fs.existsSync(new URL("../vercel.json", import.meta.url)), false);
  assert.doesNotMatch(read("package.json"), /@vercel\/analytics/);
  assert.doesNotMatch(read("app/layout.tsx"), /@vercel\/analytics|<Analytics/);
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
test("canonical sitemap exposes only rows that pass the public stream gates", () => {
  const sitemap = read("app/sitemap.ts");
  const newsSitemap = read("app/news-sitemap.xml/route.js");
  assert.match(sitemap, /isPublicNewsArticle/);
  assert.match(sitemap, /isCurrentAffairsReady/);
  assert.match(newsSitemap, /NextResponse\.redirect/);
  assert.match(newsSitemap, /\/sitemap\.xml/);
});
