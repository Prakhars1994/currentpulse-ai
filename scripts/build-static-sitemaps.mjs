import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import { CATEGORY_ROUTES } from "../lib/categoryRouting.js";
import { isStandaloneCurrentAffairsArticle } from "../lib/sitemapQuality.js";
import { selectExamSitemapRecords } from "../lib/sitemapQuality.js";

const SITE_URL = "https://cp.vliab.workers.dev";
const SHARD_SIZE = 45_000;
const PAGE_SIZE = 1_000;
const STATIC_PATHS = [
  "/", "/current-affairs", "/news", "/categories", "/quiz", "/mock-tests",
  "/pdf", "/notes", "/pyq", "/question-papers", "/videos", "/exams",
  "/about", "/contact", "/editorial-methodology", "/sources-policy",
  "/ai-usage-policy", "/corrections-policy", "/privacy", "/terms",
  "/exams/results", "/exams/admit-cards", "/exams/notifications",
  "/exams/answer-keys", "/exams/applications", "/exams/deadlines",
  "/exams/exam-dates", "/exams/cut-offs", "/exams/counselling",
];
const outDir = path.resolve(process.argv.includes("--out")
  ? process.argv[process.argv.indexOf("--out") + 1]
  : ".open-next/assets");
const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

if (!url || !key) throw new Error("Missing Supabase sitemap build credentials.");

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const escapeXml = (value = "") => String(value)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&apos;");

function articleRoute(article) {
  const sources = article.article_sources || [];
  const hasCoaching = sources.some((source) => source?.source_kind === "coaching");
  const hasNews = sources.some((source) => source?.source_kind === "news");
  if (hasCoaching && isStandaloneCurrentAffairsArticle(article)) {
    return "/current-affairs/" + article.slug;
  }
  if (hasNews) {
    return "/news/" + article.slug;
  }
  return "";
}

function sitemapXml(entries) {
  const urls = entries.map((entry) => [
    "<url>",
    `<loc>${escapeXml(SITE_URL + entry.path)}</loc>`,
    entry.lastModified ? `<lastmod>${escapeXml(entry.lastModified)}</lastmod>` : "",
    "</url>",
  ].filter(Boolean).join("")).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;
}

let cursor = 0;
const entries = [
  ...STATIC_PATHS.map((path) => ({ path })),
  ...CATEGORY_ROUTES.map((category) => ({ path: `/category/${category.slug}` })),
];
for (;;) {
  const { data, error } = await supabase
    .from("articles")
    .select("id,slug,title,updated_at,created_at,article_sources(source_kind)")
    .eq("status", "published")
    .gt("id", cursor)
    .order("id", { ascending: true })
    .limit(PAGE_SIZE);
  if (error) throw new Error(`Sitemap article query failed: ${error.message}`);
  const rows = data || [];
  for (const row of rows) {
    const route = row.slug ? articleRoute(row) : "";
    if (route) entries.push({ path: route, lastModified: row.updated_at || row.created_at || "" });
  }
  if (rows.length < PAGE_SIZE) break;
  cursor = Number(rows.at(-1)?.id || cursor);
}

await fs.mkdir(path.join(outDir, "sitemaps"), { recursive: true });
const { data: examRows, error: examError } = await supabase
  .from("exam_updates")
  .select("slug,title,agency,update_type,official_url,source_name,created_at,updated_at")
  .eq("status", "published");
if (examError && examError.code !== "42P01") {
  throw new Error(`Sitemap exam query failed: ${examError.message}`);
}
for (const exam of selectExamSitemapRecords(examRows || []).included) {
  entries.push({ path: `/exams/${exam.slug}`, lastModified: exam.updated_at || exam.created_at || "" });
}

const shards = [];
for (let offset = 0; offset < entries.length; offset += SHARD_SIZE) {
  const number = String(shards.length + 1).padStart(4, "0");
  const file = `sitemap-${number}.xml`;
  await fs.writeFile(path.join(outDir, "sitemaps", file), sitemapXml(entries.slice(offset, offset + SHARD_SIZE)), "utf8");
  shards.push(`/sitemaps/${file}`);
}

const index = shards.map((file) => `<sitemap><loc>${SITE_URL}${file}</loc></sitemap>`).join("");
await fs.writeFile(
  path.join(outDir, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${index}</sitemapindex>`,
  "utf8"
);
console.log(JSON.stringify({ entries: entries.length, shards: shards.length, shardSize: SHARD_SIZE }));
