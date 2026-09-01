import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { isStandaloneCurrentAffairsArticle } from "../lib/sitemapQuality.js";

const root = new URL("../", import.meta.url);
const read = (file) => fs.readFileSync(new URL(file, root), "utf8");

test("canonical host remains Cloudflare-only without Vercel deployment configuration", () => {
  assert.match(read("lib/siteUrl.js"), /https:\/\/cp\.vliab\.workers\.dev/);
  assert.equal(fs.existsSync(new URL("vercel.json", root)), false);
});

test("Current Affairs and News landing pages remain indexable", () => {
  assert.match(read("app/current-affairs/page.js"), /alternates:\s*\{\s*canonical/);
  assert.match(read("app/news/page.js"), /alternates:\s*\{\s*canonical/);
});

test("sitemap helper still excludes obvious helper fragments", () => {
  assert.equal(isStandaloneCurrentAffairsArticle({ title: "India's Revised FDI Framework", slug: "india-revised-fdi-framework" }), true);
  assert.equal(isStandaloneCurrentAffairsArticle({ title: "RELATED UPSC PYQ", slug: "related-upsc-pyq-20260825-abc" }), false);
});

test("admin-selected PDF articles are preserved instead of re-gated after review", () => {
  const route = read("app/api/admin/pdf-import/publish/route.js");
  assert.match(route, /preserveText/);
  assert.match(route, /manual_protected:\s*true/);
  assert.doesNotMatch(route, /isStandaloneCurrentAffairsArticle\(payload\)/);
});
