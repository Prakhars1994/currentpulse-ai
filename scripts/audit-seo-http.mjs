import fs from "node:fs/promises";
import path from "node:path";

const CANONICAL_ORIGIN = "https://cp.vliab.workers.dev";
const LEGACY_ORIGINS = [
  "https://currentpulse-ai.vercel.app",
  "https://currentpulse-ai-kl7x.vercel.app",
];

function canonical(html = "") {
  return html.match(/<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)/i)?.[1] ||
    html.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["']/i)?.[1] || "";
}
function equivalentUrl(left = "", right = "") {
  return String(left).replace(/\/$/, "") === String(right).replace(/\/$/, "");
}
function meta(html, name) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  const tag = tags.find((value) => new RegExp(`(?:name|property)=["']${name}["']`, "i").test(value));
  return tag?.match(/content=["']([^"']*)/i)?.[1] || "";
}
function locations(xml = "") {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/gi)].map((match) => match[1].replace(/&amp;/g, "&"));
}
function internalPaths(html = "", prefix = "") {
  return [...html.matchAll(/<a\b[^>]*href=["']([^"'#?]+)["']/gi)]
    .map((match) => { try { return new URL(match[1], CANONICAL_ORIGIN).pathname; } catch { return ""; } })
    .filter((value, index, all) => value.startsWith(prefix) && all.indexOf(value) === index);
}

const headers = { "user-agent": "CurrentPulseMigrationAudit/1.0" };
const sitemapResponse = await fetch(`${CANONICAL_ORIGIN}/sitemap.xml`, { headers });
const sitemapXml = await sitemapResponse.text();
const sitemapUrls = locations(sitemapXml);
const newsHtml = await (await fetch(`${CANONICAL_ORIGIN}/news`, { headers })).text();
const caPaths = sitemapUrls.filter((url) => new URL(url).pathname.startsWith("/current-affairs/")).slice(0, 5).map((url) => new URL(url).pathname);
const examPath = sitemapUrls.map((url) => new URL(url).pathname).find((value) => /^\/exams\/[^/]+$/.test(value) && !["/exams/results", "/exams/notifications", "/exams/applications", "/exams/deadlines", "/exams/counselling", "/exams/answer-keys", "/exams/admit-cards", "/exams/exam-dates", "/exams/cut-offs"].includes(value));
const newsPaths = internalPaths(newsHtml, "/news/").filter((value) => !value.startsWith("/news/page/")).slice(0, 5);
const samplePaths = [...new Set(["/", "/current-affairs", "/news", ...caPaths, ...newsPaths, "/category/polity", "/category/economy", "/category/environment"] )];
const destinationCache = new Map();

async function destination(pathname) {
  if (destinationCache.has(pathname)) return destinationCache.get(pathname);
  const response = await fetch(`${CANONICAL_ORIGIN}${pathname}`, { headers, redirect: "manual" });
  const html = await response.text();
  const result = { status: response.status, canonical: canonical(html), html, finalUrl: response.url };
  destinationCache.set(pathname, result);
  return result;
}

const migration = [];
for (const legacyOrigin of LEGACY_ORIGINS) {
  for (const pathname of samplePaths) {
    try {
      const oldUrl = `${legacyOrigin}${pathname}`;
      const expected = `${CANONICAL_ORIGIN}${pathname}`;
      const target = await destination(pathname);
      const chain = [];
      let currentUrl = oldUrl;
      let finalResponse = null;
      for (let hop = 0; hop < 5; hop += 1) {
        const response = await fetch(currentUrl, { headers, redirect: "manual" });
        const locationHeader = response.headers.get("location") || "";
        const nextUrl = locationHeader ? new URL(locationHeader, currentUrl).toString() : "";
        chain.push({ url: currentUrl, status: response.status, location: nextUrl });
        if (![301, 302, 303, 307, 308].includes(response.status) || !nextUrl) {
          finalResponse = response;
          break;
        }
        currentUrl = nextUrl;
      }
      const permanent = chain.length > 1 && chain.slice(0, -1).every((hop) => hop.status === 301 || hop.status === 308);
      migration.push({
        oldUrl,
        oldStatus: chain[0]?.status || 0,
        location: chain[0]?.location || "",
        chain,
        pathPreserved: equivalentUrl(chain[0]?.location, expected),
        permanent,
        redirectHops: Math.max(0, chain.length - 1),
        actualFinalUrl: chain.at(-1)?.url || oldUrl,
        actualFinalStatus: finalResponse?.status || chain.at(-1)?.status || 0,
        reachedCanonicalHost: equivalentUrl(chain.at(-1)?.url, expected),
        expectedFinalUrl: expected,
        canonicalDestinationStatus: target.status,
        canonical: target.canonical,
        selfCanonical: equivalentUrl(target.canonical, expected),
        vercelCanonicalLeak: /vercel\.app/i.test(target.canonical),
      });
    } catch (error) {
      migration.push({ oldUrl: `${legacyOrigin}${pathname}`, error: error?.message || String(error) });
    }
  }
}

const readerPaths = ["/", "/current-affairs", "/news", caPaths[0], newsPaths[0], examPath].filter(Boolean);
const staticReader = [];
for (const pathname of readerPaths) {
  const result = await destination(pathname);
  const head = result.html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] || "";
  const full = result.html;
  staticReader.push({
    pathname, status: result.status, staticReaderMarker: /name=["']currentpulse-static-reader["']/i.test(head),
    title: full.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || "", description: meta(full, "description"),
    robots: meta(full, "robots"), canonical: canonical(full), selfCanonical: equivalentUrl(canonical(full), `${CANONICAL_ORIGIN}${pathname}`),
    metadataInInitialHead: Boolean(canonical(head) && head.match(/<title>/i) && meta(head, "robots")),
    articleSchema: /["']@type["']\s*:\s*["'](?:Article|NewsArticle)["']/i.test(result.html),
    breadcrumbSchema: /["']@type["']\s*:\s*["']BreadcrumbList["']/i.test(result.html),
    internalLinks: internalPaths(result.html, "/").length,
    paginationLinks: internalPaths(result.html, "/").filter((value) => /\/page\/\d+$/.test(value)).length,
  });
}

const report = { generatedAt: new Date().toISOString(), sampleBasis: "Current canonical sitemap plus server-rendered News links; not an export of historical GSC URLs.", sitemapStatus: sitemapResponse.status, sitemapCount: sitemapUrls.length, samples: { caPaths, newsPaths, examPath, categories: samplePaths.filter((value) => value.startsWith("/category/")) }, migration, staticReader };
const output = path.resolve("docs/seo-indexing-http-audit.json");
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ sitemapCount: report.sitemapCount, samplePaths: samplePaths.length, migrationChecks: migration.length, migrationFailures: migration.filter((row) => row.error || !row.permanent || !row.pathPreserved || !row.reachedCanonicalHost || row.canonicalDestinationStatus !== 200 || !row.selfCanonical || row.vercelCanonicalLeak).length, staticReader: staticReader.map(({ pathname, status, staticReaderMarker, selfCanonical, internalLinks, articleSchema, breadcrumbSchema }) => ({ pathname, status, staticReaderMarker, selfCanonical, internalLinks, articleSchema, breadcrumbSchema })), report: output }, null, 2));
