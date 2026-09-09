import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { cleanSeoDescription, cleanSeoTitle } from "../lib/publicArticleRepair.js";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("SEO origin is locked to the Cloudflare production domain", () => {
  const siteUrl = read("lib/siteUrl.js");
  assert.match(siteUrl, /SITE_URL = "https:\/\/cp\.vliab\.workers\.dev"/);
  assert.doesNotMatch(siteUrl, /NEXT_PUBLIC_SITE_URL/);
});

test("AI utility pages are crawlable but excluded from indexing and the sitemap", () => {
  assert.match(read("app/ai/layout.js"), /index: false/);
  const sitemap = read("app/sitemap.ts");
  assert.doesNotMatch(sitemap, /"videos","ai","contact"/);
});

test("shared metadata does not assign every public page the homepage OpenGraph URL", () => {
  const layout = read("app/layout.tsx");
  const openGraph = layout.slice(layout.indexOf("openGraph:"), layout.indexOf("twitter:"));
  assert.doesNotMatch(openGraph, /url:\s*SITE_URL/);
});

test("article metadata removes PDF control fields and avoids mid-word truncation", () => {
  const title = cleanSeoTitle("CURRENT AFFAIRS 105: A long title that should finish on a natural word boundary for search", 50);
  const description = cleanSeoDescription("CA_CATEGORY: Economy CA_GS: GS Paper III CA_DATE: 6 September 2026 WHY IN NEWS: Inflation eased after supply conditions improved.", title, 160);
  assert.equal(title.endsWith("for"), false);
  assert.match(description, /^Inflation eased/);
  assert.doesNotMatch(description, /CA_(?:CATEGORY|GS|DATE)/);
});
