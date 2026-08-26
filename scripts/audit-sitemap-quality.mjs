import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import {
  assessExamSitemapRecord,
  examSitemapEventKey,
  isStandaloneCurrentAffairsArticle,
  selectExamSitemapRecords,
} from "../lib/sitemapQuality.js";

const SITE_URL = "https://cp.vliab.workers.dev";

function argument(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function xmlLocations(xml = "") {
  return [...String(xml).matchAll(/<loc>([\s\S]*?)<\/loc>/gi)]
    .map((match) => match[1].replace(/&amp;/g, "&").trim())
    .filter(Boolean);
}

function routeClass(pathname) {
  if (pathname === "/" || ["/current-affairs", "/news", "/exams"].includes(pathname)) return "core";
  if (pathname.startsWith("/current-affairs/")) return "current-affairs";
  if (pathname.startsWith("/news/")) return "news";
  if (pathname.startsWith("/exams/")) return "exam";
  if (pathname.startsWith("/category/")) return "category";
  return "helper/thin";
}

function normalizeTitle(value = "") {
  return String(value).toLowerCase().replace(/\b\d{1,2}[./-]\d{1,2}[./-]20\d{2}\b/g, " ")
    .replace(/\b20\d{2}\b/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
}

function suspiciousCa(row = {}) {
  return !isStandaloneCurrentAffairsArticle(row);
}

function malformedSlug(slug = "") {
  return !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(slug)) || String(slug).length < 8;
}

function lowValueExam(row = {}) {
  return !assessExamSitemapRecord(row).allowed;
}

async function databaseRows() {
  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
  if (!url || !key) return { articles: [], exams: [], error: "Supabase environment is unavailable" };
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const [articlePageOne, articlePageTwo, articlePageThree, exams] = await Promise.all([
    client.from("articles").select("id,title,slug,status,created_at,updated_at,why_news,static_foundation,prelims,mains,answer_framework,memory_trick,content,quality_score,quality_version,article_sources(source_kind,source_name,source_url)").eq("status", "published").order("created_at", { ascending: false }).range(0, 999),
    client.from("articles").select("id,title,slug,status,created_at,updated_at,why_news,static_foundation,prelims,mains,answer_framework,memory_trick,content,quality_score,quality_version,article_sources(source_kind,source_name,source_url)").eq("status", "published").order("created_at", { ascending: false }).range(1000, 1999),
    client.from("articles").select("id,title,slug,status,created_at,updated_at,why_news,static_foundation,prelims,mains,answer_framework,memory_trick,content,quality_score,quality_version,article_sources(source_kind,source_name,source_url)").eq("status", "published").order("created_at", { ascending: false }).range(2000, 2499),
    client.from("exam_updates").select("id,title,slug,status,exam_name,agency,update_type,summary,official_url,source_name,source_published_at,deadline_at,exam_date,created_at,updated_at").eq("status", "published").order("created_at", { ascending: false }).limit(1500),
  ]);
  const articleResults = [articlePageOne, articlePageTwo, articlePageThree];
  return {
    articles: articleResults.flatMap((result) => result.data || []), exams: exams.data || [],
    error: articleResults.find((result) => result.error)?.error?.message || exams.error?.message || null,
  };
}

const sitemapFile = path.resolve(argument("--sitemap-file", ".audit-sitemap-live.xml"));
const reportFile = path.resolve(argument("--out", "docs/seo-indexing-sitemap-audit.json"));
const locations = xmlLocations(await fs.readFile(sitemapFile, "utf8"));
const db = await databaseRows();
const articleBySlug = new Map(db.articles.map((row) => [row.slug, row]));
const examBySlug = new Map(db.exams.map((row) => [row.slug, row]));
const seenUrls = new Set();
const examEventKeys = new Map();

const urls = locations.map((location) => {
  let parsed;
  try { parsed = new URL(location); } catch { return { url: location, classification: "invalid", invalid: true }; }
  const classification = routeClass(parsed.pathname);
  const slug = parsed.pathname.split("/").filter(Boolean).at(-1) || "";
  const article = classification === "current-affairs" || classification === "news" ? articleBySlug.get(slug) : null;
  const exam = classification === "exam" ? examBySlug.get(slug) : null;
  const duplicate = seenUrls.has(location);
  seenUrls.add(location);
  const canonicalMismatch = parsed.origin !== SITE_URL || parsed.search !== "" || parsed.hash !== "";
  const invalid = parsed.protocol !== "https:" || !parsed.pathname.startsWith("/");
  const helperThin = classification === "current-affairs" ? suspiciousCa(article || { slug }) : classification === "exam" ? lowValueExam(exam || { slug }) : classification === "helper/thin";
  let duplicateEvent = false;
  if (exam) {
    const eventKey = examSitemapEventKey(exam);
    duplicateEvent = examEventKeys.has(eventKey);
    if (!duplicateEvent) examEventKeys.set(eventKey, exam.slug);
  }
  return {
    url: location, classification, expectedStatus: 200, expectedCanonical: `${SITE_URL}${parsed.pathname}`,
    canonicalMismatch, invalid, duplicate, helperThin, duplicateEvent,
    suspiciousFutureDate: Boolean(exam?.source_published_at && new Date(exam.source_published_at).getTime() > Date.now() + 12 * 60 * 60 * 1000),
    orphanUnknown: (classification === "current-affairs" || classification === "news") ? !article : classification === "exam" ? !exam : false,
    title: article?.title || exam?.title || null,
  };
});

const counts = urls.reduce((result, row) => {
  result[row.classification] = (result[row.classification] || 0) + 1;
  return result;
}, {});
const report = {
  generatedAt: new Date().toISOString(), source: sitemapFile, total: urls.length, counts,
  findings: {
    invalid: urls.filter((row) => row.invalid).length,
    duplicate: urls.filter((row) => row.duplicate).length,
    canonicalMismatch: urls.filter((row) => row.canonicalMismatch).length,
    helperThin: urls.filter((row) => row.helperThin).length,
    duplicateExam: urls.filter((row) => row.duplicateEvent).length,
    suspiciousFutureDate: urls.filter((row) => row.suspiciousFutureDate).length,
    orphanUnknown: urls.filter((row) => row.orphanUnknown).length,
  },
  database: { publishedArticlesLoaded: db.articles.length, publishedExamsLoaded: db.exams.length, error: db.error },
  databaseFlags: {
    helperCurrentAffairs: db.articles.filter((row) => suspiciousCa(row)).map((row) => ({ id: row.id, slug: row.slug, title: row.title })),
    lowValueExams: db.exams.filter((row) => lowValueExam(row)).map((row) => ({ id: row.id, slug: row.slug, title: row.title, source: row.source_name })),
    excludedExams: selectExamSitemapRecords(db.exams).excluded.map(({ row, reason }) => ({ id: row.id, slug: row.slug, title: row.title, source: row.source_name, reason })),
  },
  flagged: urls.filter((row) => row.invalid || row.duplicate || row.canonicalMismatch || row.helperThin || row.duplicateEvent || row.suspiciousFutureDate || row.orphanUnknown),
  urls,
};
await fs.mkdir(path.dirname(reportFile), { recursive: true });
await fs.writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ total: report.total, counts, findings: report.findings, database: report.database, report: reportFile }, null, 2));
