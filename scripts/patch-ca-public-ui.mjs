import fs from "node:fs/promises";

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

if (text === before) {
  console.log("CA public UI already patched; no changes needed.");
  process.exit(0);
}

for (const expected of [
  '<span aria-current="page">Article</span>',
  '{externalSources.length > 0 && (',
  'Original external sources cited for this article.',
  '{externalSources.map((source) => {'
]) {
  if (!text.includes(expected)) throw new Error(`Patch invariant missing: ${expected}`);
}

await fs.writeFile(file, text);
console.log("Patched CA breadcrumb and public provenance rendering.");
