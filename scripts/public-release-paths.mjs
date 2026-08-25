import fs from "node:fs/promises";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import { createCategorySlug } from "../lib/categoryRouting.js";

function arg(name, fallback = "") {
  const index = process.argv.indexOf(name);
  if (index < 0 || index + 1 >= process.argv.length) return fallback;
  return process.argv[index + 1];
}

const sinceRaw = String(arg("--since", "")).trim();
const outFile = String(arg("--out", "")).trim();
const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

if (!sinceRaw) {
  throw new Error("FULL_RELEASE_REQUIRED: missing incremental release watermark.");
}
if (!outFile) {
  throw new Error("FULL_RELEASE_REQUIRED: missing changed-path output file.");
}
if (!supabaseUrl || !serviceKey) {
  throw new Error("FULL_RELEASE_REQUIRED: Supabase release-planning credentials are missing.");
}

const sinceDate = new Date(sinceRaw);
if (Number.isNaN(sinceDate.getTime())) {
  throw new Error("FULL_RELEASE_REQUIRED: invalid incremental release watermark.");
}
if (sinceDate.getTime() > Date.now() + 5 * 60 * 1000) {
  throw new Error("FULL_RELEASE_REQUIRED: release watermark is unexpectedly in the future.");
}

// Small overlap protects against timestamp precision / clock-boundary races.
const effectiveSince = new Date(sinceDate.getTime() - 2 * 60 * 1000);

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const EXAM_INDEX_PATHS = [
  "/exams/results",
  "/exams/admit-cards",
  "/exams/notifications",
  "/exams/answer-keys",
  "/exams/applications",
  "/exams/deadlines",
  "/exams/exam-dates",
  "/exams/cut-offs",
  "/exams/counselling",
];

async function boundedChangedRows(table, fields, limit) {
  const { data, error } = await supabase
    .from(table)
    .select(fields)
    .gte("updated_at", effectiveSince.toISOString())
    .order("updated_at", { ascending: true })
    .limit(limit + 1);

  if (error) {
    throw new Error(
      `FULL_RELEASE_REQUIRED: ${table} incremental query failed: ${error.message}`
    );
  }

  const rows = data || [];
  if (rows.length > limit) {
    throw new Error(
      `FULL_RELEASE_REQUIRED: ${table} changed-row count exceeded safe incremental limit ${limit}.`
    );
  }

  return rows;
}

function chunks(values, size = 100) {
  const result = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

async function fetchArticlesByIds(ids) {
  const uniqueIds = [...new Set(ids.map(Number).filter(Boolean))];
  if (!uniqueIds.length) return [];

  const rows = [];
  for (const batch of chunks(uniqueIds, 100)) {
    const { data, error } = await supabase
      .from("articles")
      .select("id,slug,category,status,created_at,updated_at")
      .in("id", batch);

    if (error) {
      throw new Error(
        `FULL_RELEASE_REQUIRED: changed article lookup failed: ${error.message}`
      );
    }

    rows.push(...(data || []));
  }
  return rows;
}

async function fetchSourceKinds(ids) {
  const uniqueIds = [...new Set(ids.map(Number).filter(Boolean))];
  const result = new Map();
  if (!uniqueIds.length) return result;

  for (const batch of chunks(uniqueIds, 100)) {
    const { data, error } = await supabase
      .from("article_sources")
      .select("article_id,source_kind")
      .in("article_id", batch);

    if (error) {
      throw new Error(
        `FULL_RELEASE_REQUIRED: article source lookup failed: ${error.message}`
      );
    }

    for (const row of data || []) {
      const id = Number(row.article_id);
      if (!id) continue;
      if (!result.has(id)) result.set(id, new Set());
      if (row.source_kind) result.get(id).add(row.source_kind);
    }
  }

  return result;
}

const [
  changedArticles,
  changedSources,
  changedExams,
  changedQuiz,
] = await Promise.all([
  boundedChangedRows(
    "articles",
    "id,slug,category,status,created_at,updated_at",
    400
  ),
  boundedChangedRows(
    "article_sources",
    "article_id,source_kind,updated_at",
    800
  ),
  boundedChangedRows(
    "exam_updates",
    "id,slug,status,updated_at",
    400
  ),
  boundedChangedRows(
    "quiz_questions",
    "id,quiz_date,updated_at",
    100
  ),
]);

const changedArticleIds = new Set(
  changedArticles.map((row) => Number(row.id)).filter(Boolean)
);
for (const row of changedSources) {
  const id = Number(row.article_id);
  if (id) changedArticleIds.add(id);
}

const sourceOnlyIds = [...changedArticleIds].filter(
  (id) => !changedArticles.some((row) => Number(row.id) === id)
);

const sourceOnlyArticles = await fetchArticlesByIds(sourceOnlyIds);

const articleById = new Map();
for (const article of [...changedArticles, ...sourceOnlyArticles]) {
  if (article?.id) articleById.set(Number(article.id), article);
}

const sourceKinds = await fetchSourceKinds([...articleById.keys()]);
const recentlyChangedSourceKinds = new Map();

for (const row of changedSources) {
  const id = Number(row.article_id);
  if (!id || !row.source_kind) continue;
  if (!recentlyChangedSourceKinds.has(id)) {
    recentlyChangedSourceKinds.set(id, new Set());
  }
  recentlyChangedSourceKinds.get(id).add(row.source_kind);
}

const paths = new Set();
let newsChanged = false;
let coverageChanged = false;
let examChanged = false;

for (const [id, article] of articleById) {
  if (!article?.slug) continue;

  const kinds = new Set([
    ...(sourceKinds.get(id) || []),
    ...(recentlyChangedSourceKinds.get(id) || []),
  ]);

  // Match CurrentPulse's legacy News semantics: a published article with no
  // retained source rows can still belong to the historical News archive.
  const legacyNews = kinds.size === 0;

  if (kinds.has("news") || legacyNews) {
    newsChanged = true;
    paths.add(`/news/${article.slug}`);
  }

  if (kinds.has("coaching")) {
    coverageChanged = true;
    paths.add(`/current-affairs/${article.slug}`);
  }

  const categorySlug = createCategorySlug(article.category || "");
  if (categorySlug) {
    paths.add(`/category/${categorySlug}`);

    if (kinds.has("coaching")) {
      paths.add(`/current-affairs/category/${categorySlug}`);
    }
  }
}

if (articleById.size) {
  paths.add("/");
  paths.add("/sitemap.xml");
}

if (newsChanged) {
  // Immediate News releases refresh the landing page plus exact changed
  // article/category paths. Deep archive pages are reconciled by a full
  // reader release instead of every manual publication.
  paths.add("/news");
  paths.add("/news-sitemap.xml");
  paths.add("/feed.xml");
}

if (coverageChanged) {
  paths.add("/current-affairs");
}

if (changedExams.length) {
  examChanged = true;
  paths.add("/exams");

  for (const exam of changedExams) {
    if (exam?.slug) paths.add(`/exams/${exam.slug}`);
  }

  for (const route of EXAM_INDEX_PATHS) {
    paths.add(route);
  }
}

if (changedQuiz.length) {
  paths.add("/quiz");
}

if (!paths.size) {
  throw new Error(
    "FULL_RELEASE_REQUIRED: release state changed but no safe public reader paths were resolved."
  );
}

const ordered = [...paths].sort((left, right) => left.localeCompare(right));

await fs.writeFile(
  outFile,
  `${ordered.join("\n")}\n`,
  "utf8"
);

console.log(JSON.stringify({
  since: sinceDate.toISOString(),
  effectiveSince: effectiveSince.toISOString(),
  paths: ordered.length,
  changedArticles: changedArticles.length,
  changedSources: changedSources.length,
  changedExams: changedExams.length,
  changedQuiz: changedQuiz.length,
  newsChanged,
  coverageChanged,
  examChanged,
}));
