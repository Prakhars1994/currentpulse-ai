import fs from "node:fs/promises";
import { load } from "cheerio";

const origin = new URL(process.env.SEO_AUDIT_ORIGIN || "https://cp.vliab.workers.dev").origin;
const output = process.env.SEO_AUDIT_OUTPUT || "docs/indexability-quality-audit.json";
const concurrency = Math.max(1, Math.min(Number(process.env.SEO_AUDIT_CONCURRENCY) || 8, 12));
const headers = { "user-agent": "CurrentPulseIndexabilityQualityAudit/1.0" };

async function get(url) {
  return fetch(url, { headers, redirect: "manual", signal: AbortSignal.timeout(30_000) });
}

async function sitemap(url, seen = new Set(), urls = new Set()) {
  if (seen.has(url)) return urls;
  seen.add(url);
  const response = await get(url);
  if (!response.ok) throw new Error(`Sitemap HTTP ${response.status}: ${url}`);
  const $ = load(await response.text(), { xmlMode: true });
  if ($("sitemapindex").length) {
    for (const node of $("sitemap > loc").toArray()) await sitemap($(node).text(), seen, urls);
  } else if ($("urlset").length) {
    $("url > loc").each((_, node) => urls.add($(node).text()));
  } else {
    throw new Error(`Invalid sitemap: ${url}`);
  }
  return urls;
}

function pageType(url) {
  const path = new URL(url).pathname;
  if (path.startsWith("/current-affairs/")) return "current-affairs";
  if (path.startsWith("/news/")) return "news";
  if (path.startsWith("/exams/")) return "exam-update";
  return "landing";
}

function normalized(value = "") {
  return String(value).replace(/\s+/g, " ").trim().toLowerCase();
}

async function inspect(url) {
  const response = await get(url);
  const html = await response.text();
  const $ = load(html);
  const mainText = $("main").text().replace(/\s+/g, " ").trim();
  const canonical = $("link[rel='canonical']").attr("href") || "";
  const robots = $("meta[name='robots'], meta[name='googlebot']").map((_, node) => $(node).attr("content") || "").get();
  return {
    url,
    type: pageType(url),
    status: response.status,
    canonical,
    title: $("title").first().text().replace(/\s+/g, " ").trim(),
    description: $("meta[name='description']").attr("content") || "",
    h1: $("h1").length,
    words: mainText ? mainText.split(/\s+/).length : 0,
    noindex: /noindex/i.test([...robots, response.headers.get("x-robots-tag") || ""].join(",")),
    workerResourceLimit: /Worker exceeded resource limits|error code:\s*1102/i.test(html),
  };
}

async function pooled(values, worker) {
  const results = [];
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (cursor < values.length) {
      const value = values[cursor++];
      try { results.push(await worker(value)); }
      catch (error) { results.push({ url: value, type: pageType(value), error: error.message }); }
    }
  }));
  return results;
}

const urls = [...await sitemap(`${origin}/sitemap.xml`)];
const pages = await pooled(urls, inspect);
const titleCounts = new Map();
const descriptionCounts = new Map();
for (const page of pages) {
  const title = normalized(page.title);
  const description = normalized(page.description);
  if (title) titleCounts.set(title, (titleCounts.get(title) || 0) + 1);
  if (description) descriptionCounts.set(description, (descriptionCounts.get(description) || 0) + 1);
}
for (const page of pages) {
  page.issues = [];
  if (page.error || page.status !== 200) page.issues.push("non-200-or-fetch-error");
  if (page.workerResourceLimit) page.issues.push("worker-resource-limit");
  if (page.noindex) page.issues.push("noindex-in-sitemap");
  if (page.canonical.replace(/\/$/, "") !== page.url.replace(/\/$/, "")) page.issues.push("canonical-mismatch");
  if (!page.title || !page.description || page.h1 !== 1) page.issues.push("incomplete-page-signals");
  if (["current-affairs", "news"].includes(page.type) && page.words < 250) page.issues.push("short-main-content-review");
  if ((titleCounts.get(normalized(page.title)) || 0) > 1) page.issues.push("duplicate-title-review");
  if ((descriptionCounts.get(normalized(page.description)) || 0) > 1) page.issues.push("duplicate-description-review");
}
const byType = Object.fromEntries([...new Set(pages.map((page) => page.type))].map((type) => {
  const rows = pages.filter((page) => page.type === type);
  return [type, {
    total: rows.length,
    medianWords: [...rows].sort((a, b) => a.words - b.words)[Math.floor(rows.length / 2)]?.words || 0,
    issues: rows.filter((page) => page.issues.length).length,
  }];
}));
const report = {
  generatedAt: new Date().toISOString(), origin, total: pages.length, byType,
  issueCounts: Object.fromEntries([...new Set(pages.flatMap((page) => page.issues))].map((issue) => [issue, pages.filter((page) => page.issues.includes(issue)).length])),
  examples: pages.filter((page) => page.issues.length).slice(0, 100),
};
await fs.mkdir(new URL("..", new URL(output, `file://${process.cwd()}/`)), { recursive: true }).catch(() => {});
await fs.writeFile(output, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
