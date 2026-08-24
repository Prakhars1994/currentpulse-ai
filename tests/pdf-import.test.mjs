import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

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

test("PDF importer exposes exactly two admin PDF lanes", () => {
  const pageSource = load("components/admin/PdfImportWorkspace.jsx");
  const sidebar = load("components/admin/AdminSidebar.jsx");

  assert.match(pageSource, /stream="ca"/);
  assert.match(pageSource, /stream="news"/);
  assert.match(pageSource, /Current Affairs PDF/);
  assert.match(pageSource, /News PDF/);
  assert.match(pageSource, /No AI call is used for extraction/);
  assert.match(sidebar, /PDF Import/);
  assert.match(sidebar, /\/admin\/pdf-import/);
});

test("PDF extraction is browser-side and raw PDF is not uploaded", () => {
  const client = load("lib/pdf/clientExtract.js");
  const admin = load("app/admin/pdf-import/page.js");

  assert.match(client, /pdfjs-dist\/legacy\/build\/pdf\.mjs/);
  assert.match(client, /crypto\.subtle\.digest/);
  assert.doesNotMatch(admin, /FormData\(\)/);
  assert.doesNotMatch(admin, /\/api\/upload/);
});

test("PDF publish route records CA and News source rows", () => {
  const route = load("app/api/admin/pdf-import/publish/route.js");

  assert.match(route, /MAX_ARTICLES_PER_REQUEST = 20/);
  assert.match(route, /source_kind: stream === "ca" \? "coaching" : "news"/);
  assert.match(route, /CurrentPulse Admin CA PDF/);
  assert.match(route, /CurrentPulse Admin News PDF/);
  assert.match(route, /zero_ai_pdf_import/);
  assert.match(route, /full_text_preserved/);
  assert.match(route, /releaseRequired: published > 0/);
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
