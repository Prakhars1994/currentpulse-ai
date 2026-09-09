import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
import * as archiveSeo from "../lib/archiveSeo.js";

const require = createRequire(import.meta.url);
function pageModule(file) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
    fileName: file,
  }).outputText;
  const modules = {
    "next/navigation": { notFound() { throw new Error("NEXT_NOT_FOUND"); } },
    "next/link": { default: "a" },
    "@/lib/archiveSeo": archiveSeo,
    "@/lib/siteUrl": { SITE_URL: "https://cp.vliab.workers.dev" },
    "@/lib/examPrep/sourceRegistry": { getExamVertical: () => ({ slug: "upsc", title: "UPSC Current Affairs", description: "Study briefs" }) },
    "@/lib/articleStreams": {
      loadCurrentAffairsDates: async () => ({ dates: ["2026-09-06"] }),
      loadCurrentAffairsDatePage: async () => ({ articles: [], total: 0 }),
      loadCurrentAffairsArticles: async () => ({ articles: [] }),
      loadNewsArticles: async () => ({ articles: [], total: 0 }),
    },
  };
  vm.runInNewContext(code, { exports, console, URLSearchParams, require: (name) => modules[name] || (name.startsWith("@/") ? {} : require(name)) });
  return exports;
}

test("actual archive metadata keeps later pages self-canonical", async () => {
  const page = pageModule("app/current-affairs/page.js");
  const meta = await page.generateMetadata({ searchParams: Promise.resolve({ date: "2026-09-06", page: "2" }) });
  assert.equal(meta.alternates.canonical, "https://cp.vliab.workers.dev/current-affairs?date=2026-09-06&page=2");
  const hindi = pageModule("app/current-affairs/hindi/page.js");
  const hindiMeta = await hindi.generateMetadata({ searchParams: Promise.resolve({ page: "2" }) });
  assert.equal(hindiMeta.alternates.canonical, "https://cp.vliab.workers.dev/current-affairs/hindi?page=2");
});

test("empty later archive pages use Next notFound instead of rendering soft 404s", async () => {
  for (const file of ["app/current-affairs/page.js", "app/current-affairs/hindi/page.js", "app/news/page.js"]) {
    const page = pageModule(file);
    await assert.rejects(page.default({ searchParams: Promise.resolve({ page: "99999" }) }), /NEXT_NOT_FOUND/);
    await assert.rejects(page.generateMetadata({ searchParams: Promise.resolve({ page: "1.5" }) }), /NEXT_NOT_FOUND/);
  }
});
