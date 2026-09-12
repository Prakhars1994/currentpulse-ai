import fs from "node:fs/promises";

// Idempotent patch used to keep protected CA pages student-facing and free of internal publishing UI.
const file = "app/current-affairs/[slug]/page.js";
let text = await fs.readFile(file, "utf8");
const before = text;

text = text.replace(
  '<span>{article.title}</span>',
  '<span aria-current="page">Article</span>'
);

text = text.replace(
  '{articleSources?.length > 0 && (',
  '{externalSources.length > 0 && ('
);

text = text.replace(
  'Provenance recorded for this article. Administrator-supplied PDF imports are shown as labels; external links are included only when an original source URL is available.',
  'Original external sources cited for this article.'
);

text = text.replace(
  '{articleSources.map((source) => {',
  '{externalSources.map((source) => {'
);

text = text.replace(
  '    article?.question,\n  ]',
  '    article?.question,\n    article?.content,\n  ]'
);

const jumpNav = `        <nav className="article-jump-nav" aria-label="Article sections">\n          <span>Jump to</span>\n          <a href="#why-in-news">News</a>\n          <a href="#syllabus">Syllabus</a>\n          {article.static_foundation && <a href="#static-foundation">Static</a>}\n          {article.data_examples && <a href="#evidence">Evidence</a>}\n          <a href="#prelims">Prelims</a>\n          {(article.mains || article.answer_framework) && <a href="#mains">Mains</a>}\n        </nav>`;

const protectedJumpNav = `        {!isProtectedManualImport && (\n          <nav className="article-jump-nav" aria-label="Article sections">\n            <span>Jump to</span>\n            <a href="#why-in-news">News</a>\n            <a href="#syllabus">Syllabus</a>\n            {article.static_foundation && <a href="#static-foundation">Static</a>}\n            {article.data_examples && <a href="#evidence">Evidence</a>}\n            <a href="#prelims">Prelims</a>\n            {(article.mains || article.answer_framework) && <a href="#mains">Mains</a>}\n          </nav>\n        )}`;

text = text.replace(jumpNav, protectedJumpNav);

if (text === before) {
  console.log("CA public UI already patched; no changes needed.");
  process.exit(0);
}

for (const expected of [
  '<span aria-current="page">Article</span>',
  '{externalSources.length > 0 && (',
  'Original external sources cited for this article.',
  '{externalSources.map((source) => {',
  'article?.content,',
  '{!isProtectedManualImport && ('
]) {
  if (!text.includes(expected)) throw new Error(`Patch invariant missing: ${expected}`);
}

await fs.writeFile(file, text);
console.log("Patched CA breadcrumb, provenance, reading time and protected jump navigation.");
