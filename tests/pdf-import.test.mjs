import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

function load(relative) {
  return fs.readFileSync(new URL(`../${relative}`, import.meta.url), "utf8");
}

async function loadImportFormat() {
  const source = load("lib/pdf/importFormat.js");
  const tmp = path.resolve(process.cwd(), "tests/.tmp-import-format.mjs");
  fs.writeFileSync(tmp, source, "utf8");
  return {
    module: await import(`${pathToFileURL(tmp).href}?v=${Date.now()}`),
    cleanup: () => fs.rmSync(tmp, { force: true }),
  };
}

test("PDF importer exposes separate English CA, Hindi CA and News PDF lanes", () => {
  const workspace = load("components/admin/PdfImportWorkspace.jsx");

  assert.match(workspace, /Current Affairs PDF/);
  assert.match(workspace, /Hindi Current Affairs PDF/);
  assert.match(workspace, /News PDF/);
  assert.match(workspace, /stream:\s*"ca"/);
  assert.match(workspace, /stream:\s*"ca_hi"/);
  assert.match(workspace, /stream:\s*"news"/);
});

test("PDF lanes use visible chooser labels connected to separate hidden file inputs", () => {
  const workspace = load("components/admin/PdfImportWorkspace.jsx");

  assert.match(workspace, /Choose PDF/);
  assert.match(workspace, /htmlFor=/);
  assert.match(workspace, /type="file"/);
  assert.match(workspace, /accept="application\/pdf"/);
});

test("PDF extraction is browser-side and raw PDF is not uploaded", () => {
  const client = load("lib/pdf/clientExtract.js");
  const admin = load("app/admin/pdf-import/page.js");

  assert.match(client, /PDFJS_MODULE_URL/);
  assert.match(client, /webpackIgnore: true/);
  assert.match(client, /crypto\.subtle\.digest/);
  assert.doesNotMatch(admin, /FormData\(\)/);
  assert.doesNotMatch(admin, /\/api\/upload/);
});

test("PDF publish route records English CA, Hindi CA and News source rows", () => {
  const route = load("app/api/admin/pdf-import/publish/route.js");

  assert.match(route, /MAX_ARTICLES_PER_REQUEST = 20/);
  assert.match(route, /stream === "ca" \|\| stream === "ca_hi"/);
  assert.match(route, /CurrentPulse Admin CA PDF/);
  assert.match(route, /CurrentPulse Admin News PDF/);
  assert.match(route, /zero_ai_pdf_import/);
  assert.match(route, /full_text_preserved/);
  assert.match(route, /releaseRequired: releaseRows\.length > 0/);
  assert.match(route, /language: stream === "ca_hi" \? "hi" : "en"/);
  assert.match(route, /map_locations: mapLocations/);
  assert.match(route, /image_url: imageUrl \|\| null/);
});

test("CA admin PDF stays an internal policy exception", () => {
  const sourcePolicy = load("lib/coverage/sourcePolicy.js");

  assert.match(sourcePolicy, /currentpulse admin ca pdf/);
  assert.match(sourcePolicy, /cp\.vliab\.workers\.dev/);
});

test("PDF front matter cannot become article titles", async () => {
  const { module, cleanup } = await loadImportFormat();
  try {
    const text = `CurrentPulse Current Affairs\nIssue 12\n[[CA_START]]\nCA_TITLE: Real policy topic\nCA_CATEGORY: Polity & Governance\nCA_GS: GS II\nCA_DATE: 2026-09-12\n## FAST READ\n- Real update\n[[CA_END]]`;
    const parsed = module.parseCurrentPulseCaPdf(text);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].title, "Real policy topic");
  } finally {
    cleanup();
  }
});

test("synthetic PDF headings become separate CA articles", async () => {
  const { module, cleanup } = await loadImportFormat();
  try {
    const text = `[[CA_START]]\nCA_TITLE: First topic\nCA_CATEGORY: Economy\nCA_GS: GS III\nCA_DATE: 2026-09-12\n## FAST READ\n- First update\n[[CA_END]]\n[[CA_START]]\nCA_TITLE: Second topic\nCA_CATEGORY: Environment\nCA_GS: GS III\nCA_DATE: 2026-09-12\n## FAST READ\n- Second update\n[[CA_END]]`;
    const parsed = module.parseCurrentPulseCaPdf(text);
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0].title, "First topic");
    assert.equal(parsed[1].title, "Second topic");
  } finally {
    cleanup();
  }
});

test("strict markers are the only boundaries and fail closed", async () => {
  const { module, cleanup } = await loadImportFormat();
  try {
    assert.throws(() => module.parseCurrentPulseCaPdf("CURRENT AFFAIRS 1\nLoose topic\nFAST READ\n- Something"));
  } finally {
    cleanup();
  }
});

test("CA display headings are renderer-only and import safeguards remain intact", () => {
  const renderer = load("components/article/ArticleBody.jsx");
  const format = load("lib/pdf/importFormat.js");

  assert.match(renderer, /FAST READ/);
  assert.match(format, /\[\[CA_START\]\]/);
  assert.match(format, /\[\[CA_END\]\]/);
});
