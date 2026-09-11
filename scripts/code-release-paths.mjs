import fs from "node:fs/promises";
import process from "node:process";
import { execFileSync } from "node:child_process";

function arg(name, fallback = "") {
  const index = process.argv.indexOf(name);
  if (index < 0 || index + 1 >= process.argv.length) return fallback;
  return process.argv[index + 1];
}

const before = String(arg("--before", "")).trim();
const head = String(arg("--head", "HEAD")).trim() || "HEAD";
const outFile = String(arg("--out", "")).trim();
const base = String(arg("--base", "http://127.0.0.1:3100")).replace(/\/+$/, "");

if (!outFile) throw new Error("FULL_RELEASE_REQUIRED: missing output path.");
if (!before || /^0+$/.test(before)) throw new Error("FULL_RELEASE_REQUIRED: missing usable previous commit.");

let changedFiles;
try {
  changedFiles = execFileSync("git", ["diff", "--name-only", before, head], { encoding: "utf8" })
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);
} catch (error) {
  throw new Error(`FULL_RELEASE_REQUIRED: could not inspect code changes: ${error?.message || error}`);
}

const paths = new Set();
let allCurrentAffairs = false;
let allNews = false;
let allCategories = false;
let allExams = false;
let fullRequired = false;

const ignored = (file) =>
  file === ".github/workflows/currentpulse-production.yml" ||
  file === "scripts/code-release-paths.mjs" ||
  file === "scripts/build-static-sitemaps.mjs" ||
  file.startsWith("tests/") ||
  file.startsWith("docs/") ||
  file.startsWith("supabase/") ||
  file.startsWith("app/admin/") ||
  file.startsWith("app/api/") ||
  file.startsWith("lib/publisher/") ||
  file.startsWith("lib/automation/") ||
  file.endsWith(".md") ||
  file.endsWith(".txt") ||
  file.endsWith(".sql") ||
  file.endsWith(".cmd") ||
  file.startsWith("tools/");

const globalFiles = new Set([
  "package.json",
  "package-lock.json",
  "next.config.ts",
  "open-next.config.ts",
  "wrangler.jsonc",
  "middleware.ts",
  "app/layout.tsx",
  "app/globals.css",
  "components/SiteShell.jsx",
  "components/Navbar.tsx",
  "components/Footer.tsx",
  "lib/siteUrl.js",
  "lib/editorial/publicationSafety.js",
  "lib/articleStreams.js",
  "lib/sitemapQuality.js",
  "scripts/materialize-static-reader.mjs",
]);

for (const file of changedFiles) {
  if (ignored(file)) continue;
  if (globalFiles.has(file)) {
    fullRequired = true;
    continue;
  }

  // The production workflow always rebuilds sitemap.xml and its shards after
  // reader materialization. Changing the dynamic sitemap implementation does
  // not require re-rendering unrelated reader HTML, so keep this bounded.
  if (file === "app/sitemap.ts") {
    paths.add("/");
    continue;
  }

  if (["app/page.tsx", "components/Hero.tsx", "components/LatestNews.tsx", "components/ResultPulsePreview.jsx"].includes(file)) {
    paths.add("/");
    continue;
  }

  if (file === "app/current-affairs/[slug]/page.js") {
    allCurrentAffairs = true;
    continue;
  }
  if (file === "app/news/[slug]/page.js" || file === "components/LicensedNewsArticle.jsx") {
    allNews = true;
    continue;
  }
  if (file === "app/category/[slug]/page.tsx" || file === "lib/categoryArticles.js" || file === "lib/categoryRouting.js") {
    allCategories = true;
    continue;
  }
  if (file === "app/exams/[slug]/page.js" || file === "components/ExamUpdatesPage.jsx") {
    allExams = true;
    continue;
  }

  if (file === "app/current-affairs/page.js" || file === "app/current-affairs/hindi/page.js") {
    paths.add(file.includes("/hindi/") ? "/current-affairs/hindi" : "/current-affairs");
    continue;
  }
  if (file === "app/news/page.js") {
    paths.add("/news");
    continue;
  }
  if (file === "app/exams/page.js") {
    paths.add("/exams");
    continue;
  }
  if (file === "app/quiz/page.js") {
    paths.add("/quiz");
    continue;
  }
  if (file === "app/pdf/page.js") {
    paths.add("/pdf");
    continue;
  }

  if (file.startsWith("components/ArticleContent") ||
      file === "components/ArticleStudyVisuals.jsx" ||
      file === "components/EvidenceHighlights.jsx") {
    allCurrentAffairs = true;
    allNews = true;
    continue;
  }
  if (["components/CompactMarkdownSection.jsx", "components/MainsAccordion.jsx", "components/PrelimsPracticeCard.jsx", "components/MapMasteryPanel.jsx", "components/RelatedYouTubeVideo.jsx", "lib/articleSectionDedupe.js", "lib/publicArticleRepair.js", "lib/news/categoryImage.js"].includes(file)) {
    allCurrentAffairs = true;
    continue;
  }

  if (file.startsWith("public/")) continue;
  if (file.startsWith(".github/workflows/")) continue;

  const staticPage = file.match(/^app\/(.+)\/page\.(?:js|jsx|ts|tsx)$/);
  if (staticPage && !staticPage[1].includes("[") && !staticPage[1].startsWith("admin/")) {
    paths.add(`/${staticPage[1]}`.replace(/\/+$/, ""));
    continue;
  }

  if (file.startsWith("app/") || file.startsWith("components/") || file.startsWith("lib/")) {
    fullRequired = true;
    continue;
  }
}

if (fullRequired) {
  throw new Error(`FULL_RELEASE_REQUIRED: change set contains global or unclassified public code: ${changedFiles.join(", ")}`);
}

async function sitemapPaths() {
  const response = await fetch(`${base}/sitemap.xml`, {
    headers: { "user-agent": "CurrentPulseCodeReleasePlanner/1.0" },
  });
  if (!response.ok) throw new Error(`FULL_RELEASE_REQUIRED: local sitemap returned ${response.status}.`);
  const xml = await response.text();
  return [...xml.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)]
    .map((match) => String(match[1] || "").replace(/&amp;/g, "&").trim())
    .map((value) => {
      try { return new URL(value).pathname.replace(/\/+$/, "") || "/"; }
      catch { return ""; }
    })
    .filter(Boolean);
}

if (allCurrentAffairs || allNews || allCategories || allExams) {
  const sitemap = await sitemapPaths();
  for (const pathname of sitemap) {
    if (allCurrentAffairs && pathname.startsWith("/current-affairs/") && !pathname.startsWith("/current-affairs/category/") && pathname !== "/current-affairs/hindi") paths.add(pathname);
    if (allNews && pathname.startsWith("/news/") && !pathname.startsWith("/news/page/")) paths.add(pathname);
    if (allCategories && pathname.startsWith("/category/")) paths.add(pathname);
    if (allExams && pathname.startsWith("/exams/") && pathname.split("/").filter(Boolean).length === 2) paths.add(pathname);
  }
}

if (!paths.size) paths.add("/");

const ordered = [...paths].sort((a, b) => a.localeCompare(b));
if (ordered.length > 1150) {
  throw new Error(`FULL_RELEASE_REQUIRED: incremental plan is too large (${ordered.length} routes).`);
}

await fs.writeFile(outFile, `${ordered.join("\n")}\n`, "utf8");
console.log(JSON.stringify({ mode: "incremental", changedFiles, paths: ordered.length, allCurrentAffairs, allNews, allCategories, allExams }));
