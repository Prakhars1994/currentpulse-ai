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

// A repeated long passage is repairable at render time by suppressRepeatedArticleSections().
// Do not turn otherwise valid, published CA cards into internal 404s for that one condition.
text = text.replace(
  'import { isPublishedArticleSafe } from "@/lib/editorial/publicationSafety";',
  'import { assessPublishedArticle } from "@/lib/editorial/publicationSafety";'
);

const safetyHelper = `function isCurrentAffairsPubliclySafe(article = {}) {\n  const assessment = assessPublishedArticle(article, { stream: "coverage" });\n  return assessment.allowed || assessment.code === "repeated_long_passage";\n}\n\n`;
if (!text.includes('function isCurrentAffairsPubliclySafe(article = {})')) {
  text = text.replace('// Remove HTML tags for SEO descriptions and reading-time calculation\n', safetyHelper + '// Remove HTML tags for SEO descriptions and reading-time calculation\n');
}
text = text.replaceAll(
  'isPublishedArticleSafe(article, { stream: "coverage" })',
  'isCurrentAffairsPubliclySafe(article)'
);
text = text.replaceAll(
  'isPublishedArticleSafe(item, { stream: "coverage" })',
  'isCurrentAffairsPubliclySafe(item)'
);
text = text.replaceAll(
  'isPublishedArticleSafe(previousArticle, { stream: "coverage" })',
  'isCurrentAffairsPubliclySafe(previousArticle)'
);
text = text.replaceAll(
  'isPublishedArticleSafe(nextArticle, { stream: "coverage" })',
  'isCurrentAffairsPubliclySafe(nextArticle)'
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
  '{!isProtectedManualImport && (',
  'import { assessPublishedArticle } from "@/lib/editorial/publicationSafety";',
  'function isCurrentAffairsPubliclySafe(article = {})',
  'assessment.code === "repeated_long_passage"'
]) {
  if (!text.includes(expected)) throw new Error(`Patch invariant missing: ${expected}`);
}

await fs.writeFile(file, text);
console.log("Patched CA reader UX and kept render-dedupe-repairable published articles reachable.");
