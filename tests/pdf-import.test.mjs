import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { normalizePdfExtractionArtifacts } from "../lib/pdf/clientExtract.js";

function load(relative) {
  return fs.readFileSync(
    new URL(`../${relative}`, import.meta.url),
    "utf8"
  );
}

function page(pageNumber, lines) {
  return {
    pageNumber,
    width: 600,
    height: 800,
    lines,
  };
}

test("PDF extraction repairs only deterministic glyph artifacts", () => {
  const source = "India has the 2 nd-largest network. Action Plan s improve loGIstics and brinGIng. GI tags remain protected.";
  assert.equal(
    normalizePdfExtractionArtifacts(source),
    "India has the 2nd-largest network. Action Plans improve logistics and bringing. GI tags remain protected."
  );
});

test("PDF importer exposes separate English CA, Hindi CA and News PDF lanes", () => {
  const pageSource = load("components/admin/PdfImportWorkspace.jsx");
  const sidebar = load("components/admin/AdminSidebar.jsx");

  assert.match(pageSource, /stream="ca"/);
  assert.match(pageSource, /stream="ca_hi"/);
  assert.match(pageSource, /stream="news"/);
  assert.match(pageSource, /Current Affairs PDF/);
  assert.match(pageSource, /हिंदी Current Affairs PDF/);
  assert.match(pageSource, /News PDF/);
  assert.match(pageSource, /No AI call is used for extraction/);
  assert.match(sidebar, /PDF Import/);
  assert.match(sidebar, /\/admin\/pdf-import/);
});

test("PDF lanes use visible chooser labels connected to separate hidden file inputs", () => {
  const workspace = load("components/admin/PdfImportWorkspace.jsx");

  assert.match(workspace, /const fileInputId = `pdf-file-\$\{stream\}`/);
  assert.match(workspace, /id=\{fileInputId\}/);
  assert.match(workspace, /htmlFor=\{fileInputId\}/);
  assert.match(workspace, /Choose PDF/);
  assert.match(workspace, /className="sr-only"/);
  assert.match(workspace, /sticky top-4 z-20/);
  assert.match(workspace, /Upload a PDF/);
  assert.match(workspace, /No PDF selected/);
  assert.match(workspace, /disabled=\{!file \|\| reading \|\| publishing\}/);
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
  assert.match(route, /releaseRequired: published > 0/);
  assert.match(route, /language: stream === "ca_hi" \? "hi" : "en"/);
  assert.match(route, /map_locations: mapLocations/);
  assert.match(route, /image_url: imageUrl \|\| null/);
});

test("CA admin PDF stays an internal policy exception", () => {
  const sourcePolicy = load("lib/coverage/sourcePolicy.js");

  assert.match(sourcePolicy, /currentpulse admin ca pdf/);
  assert.match(sourcePolicy, /cp\.vliab\.workers\.dev/);

  const policyEntries = [...sourcePolicy.matchAll(/id:\s*"([^"]+)"/g)]
    .map((match) => match[1]);

  assert.deepEqual(
    policyEntries.slice(0, 7),
    ["vision", "drishti", "insights", "forum", "nextias", "vajiram", "iasbaba"]
  );
});

test("PDF front matter cannot become article titles", () => {
  const importer = load("lib/pdf/importFormat.js");
  const safety = load("lib/editorial/publicationSafety.js");
  for (const marker of ["currentpulse\\s+ai", "today['’]?s", "how\\s+to\\s+use", "topic\\s+mix", "related\\s+upsc"]) {
    assert.ok(importer.toLowerCase().includes(marker.toLowerCase()));
    assert.ok(safety.toLowerCase().includes(marker.toLowerCase()));
  }
});

test("synthetic PDF headings become separate CA articles", async () => {
  const original = load("lib/pdf/importFormat.js");
  const taxonomyUrl = pathToFileURL(
    path.resolve(process.cwd(), "lib/contentTaxonomy.js")
  ).href;
  const source = original.replace(
    '"@/lib/contentTaxonomy"',
    JSON.stringify(taxonomyUrl)
  );
  const tempPath = path.resolve(
    process.cwd(),
    "tests/.tmp-pdf-import-format.mjs"
  );
  fs.writeFileSync(tempPath, source, "utf8");

  try {
    const { buildPdfImportPreview } = await import(
      `${pathToFileURL(tempPath).href}?v=${Date.now()}`
    );

    const preview = buildPdfImportPreview({
      stream: "ca",
      fileName: "daily-ca.pdf",
      fileHash: "a".repeat(64),
      pages: [
        page(1, [
          { text: "CurrentPulse Daily", fontSize: 9, bold: false, y: 780 },
          { text: "India-EU Trade Agreement", fontSize: 18, bold: true, y: 700 },
          { text: "Why in News", fontSize: 11, bold: true, y: 660 },
          { text: "India and the European Union announced a new trade milestone.", fontSize: 10, bold: false, y: 630 },
          { text: "Prelims", fontSize: 11, bold: true, y: 590 },
          { text: "The EU is a political and economic union of European states.", fontSize: 10, bold: false, y: 560 },
          { text: "Page 1", fontSize: 9, bold: false, y: 20 },
        ]),
        page(2, [
          { text: "CurrentPulse Daily", fontSize: 9, bold: false, y: 780 },
          { text: "New Wetland Conservation Programme", fontSize: 18, bold: true, y: 700 },
          { text: "Background", fontSize: 11, bold: true, y: 660 },
          { text: "Wetlands support biodiversity, water regulation and local livelihoods.", fontSize: 10, bold: false, y: 630 },
          { text: "Mains", fontSize: 11, bold: true, y: 590 },
          { text: "Implementation depends on local institutions and ecological monitoring.", fontSize: 10, bold: false, y: 560 },
          { text: "Page 2", fontSize: 9, bold: false, y: 20 },
        ]),
        page(3, [
          { text: "CurrentPulse Daily", fontSize: 9, bold: false, y: 780 },
          { text: "Closing note for the wetland programme provides additional implementation detail and must remain attached.", fontSize: 10, bold: false, y: 640 },
          { text: "Page 3", fontSize: 9, bold: false, y: 20 },
        ]),
      ],
    });

    assert.equal(preview.drafts.length, 2);
    assert.match(preview.drafts[0].title, /India-EU Trade Agreement/);
    assert.match(preview.drafts[0].why_news, /trade milestone/);
    assert.match(preview.drafts[0].prelims, /European states/);
    assert.match(preview.drafts[1].static_foundation, /Wetlands support biodiversity/);
    assert.match(preview.drafts[1].mains, /Implementation depends/);
    assert.match(preview.drafts[1].fullText, /Closing note/);
    assert.equal(preview.stats.zeroAi, true);
  } finally {
    fs.rmSync(tempPath, { force: true });
  }
});

test("strict markers are the only boundaries and fail closed", async () => {
  const original = load("lib/pdf/importFormat.js");
  const taxonomyUrl = pathToFileURL(path.resolve(process.cwd(), "lib/contentTaxonomy.js")).href;
  const tempPath = path.resolve(process.cwd(), "tests/.tmp-strict-pdf.mjs");
  fs.writeFileSync(tempPath, original.replace('"@/lib/contentTaxonomy"', JSON.stringify(taxonomyUrl)), "utf8");
  try {
    const { buildPdfImportPreview } = await import(`${pathToFileURL(tempPath).href}?v=${Date.now()}`);
    const lines = [
      "[[CA_START]]", "CA_TITLE: First Article", "CA_CATEGORY: International Relations", "CA_GS: GS Paper II", "CA_DATE: 31 August 2026", "CA_IMAGE: NO", "Why in News", "**important UPSC keyword**", "## Way Forward", "Probable Mains Question", "[[CA_END]]",
      "[[CA_START]]", "CA_TITLE: Second Article", "CA_CATEGORY: Environment", "CA_GS: GS Paper III", "CA_DATE: 31 August 2026", "CA_IMAGE: YES", "### Internal heading", "body", "[[CA_END]]",
      "[[CA_START]]", "CA_TITLE: Third Article", "CA_CATEGORY: Economy", "CA_GS: GS Paper III", "CA_DATE: 31 August 2026", "CA_IMAGE: https://example.com/a.png", "1. Numbered section", "body", "[[CA_END]]",
    ];
    const preview = buildPdfImportPreview({ stream: "ca", fileName: "strict.pdf", pages: [page(1, lines.map((text, i) => ({ text, fontSize: i % 3 === 0 ? 20 : 10, bold: true, y: 780 - i * 20 })))] });
    assert.equal(preview.drafts.length, 3);
    assert.equal(preview.drafts[0].category, "International Relations");
    assert.equal(preview.drafts[0].paper, "GS Paper II");
    assert.match(preview.drafts[0].fullText, /\*\*important UPSC keyword\*\*/);
    assert.doesNotMatch(preview.drafts[0].fullText, /CA_TITLE|CA_START|CA_END/);
    assert.throws(() => buildPdfImportPreview({ stream: "ca", pages: [page(1, [{ text: "[[CA_START]]", fontSize: 10, y: 500 }])] }), /Invalid CurrentPulse CA PDF format/);
  } finally { fs.rmSync(tempPath, { force: true }); }
});

test("CA display headings are renderer-only and import safeguards remain intact", () => {
  const importer = load("lib/pdf/importFormat.js");
  const renderer = load("components/ArticleContent.jsx");
  const route = load("app/api/admin/pdf-import/publish/route.js");

  assert.match(importer, /parseStrictMarkerDrafts/);
  assert.match(importer, /hasMarkers/);
  assert.doesNotMatch(importer, /Why in News[\s\S]{0,120}segments\.push/);
  for (const label of ["Why in News", "Prelims Quick Revision", "Way Forward", "Probable Mains Question"]) {
    assert.match(renderer, new RegExp(label));
  }
  assert.ok(renderer.includes("CA_(?:START|END)"));
  assert.ok(renderer.includes("CA_(?:TITLE|CATEGORY|GS|DATE|IMAGE)"));
  assert.match(renderer, /remarkGfm/);
  assert.match(renderer, /strictPdf\?normalizeStrictPdfMarkdown\(source\):normalizeMarkdown\(source\)/);
  assert.doesNotMatch(renderer, /<pre className="strict-pdf-verbatim">/);
  assert.match(renderer, /year\|month\|day\|category\|km\|GW\|MW\|MT\|LMT/);
  assert.match(route, /existing\.has\(item\.sourceKey\)/);
  assert.match(route, /status: "duplicate"/);
  assert.match(route, /manual_protected: true/);
});
