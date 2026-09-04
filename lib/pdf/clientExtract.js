"use client";

const PDFJS_VERSION = "6.2.108";
const PDFJS_MODULE_URL =
  `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/legacy/build/pdf.mjs`;
const PDF_WORKER_URL =
  `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;

function cleanText(value = "") {
  return String(value || "")
    .replace(/\u00ad/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// These are PDF text-layer artifacts, not editorial corrections. Keep the
// transformations deliberately narrow so manual PDF wording remains intact.
export function normalizePdfExtractionArtifacts(value = "") {
  return String(value || "")
    .replace(/\b(\d+)\s+(st|nd|rd|th)(?=\b|-)/gi, "$1$2")
    .replace(/\bAction Plan\s+s\b/gi, (match) => match.replace(/\s+s$/i, "s"))
    .replace(/\b(?=[A-Za-z]*[a-z])[A-Za-z]*GI[A-Za-z]*\b/g, (word) =>
      word.replace(/GI/g, "gi")
    );
}

function joinLineItems(items = []) {
  const ordered = [...items].sort((a, b) => a.x - b.x);
  let text = "";

  for (const item of ordered) {
    const value = cleanText(item.text);
    if (!value) continue;

    if (!text) {
      text = value;
      continue;
    }

    if (text.endsWith("-") && /^[a-z]/.test(value)) {
      text = text.slice(0, -1) + value;
      continue;
    }

    text += ` ${value}`;
  }

  return normalizePdfExtractionArtifacts(cleanText(text));
}

function groupItemsIntoLines(items = []) {
  const buckets = [];

  for (const item of items) {
    const text = cleanText(item.str);
    if (!text) continue;

    const transform = Array.isArray(item.transform) ? item.transform : [];
    const x = Number(transform[4] || 0);
    const y = Number(transform[5] || 0);
    const fontSize = Math.max(
      1,
      Math.abs(Number(transform[3] || 0)),
      Math.hypot(Number(transform[2] || 0), Number(transform[3] || 0))
    );

    let bucket = buckets.find((candidate) => Math.abs(candidate.y - y) <= 2.4);

    if (!bucket) {
      bucket = { y, items: [] };
      buckets.push(bucket);
    }

    bucket.items.push({
      text,
      x,
      fontSize,
      fontName: String(item.fontName || ""),
    });
  }

  return buckets
    .sort((a, b) => b.y - a.y)
    .map((bucket) => {
      const lineText = joinLineItems(bucket.items);
      const fontSize = Math.max(
        ...bucket.items.map((item) => Number(item.fontSize || 1))
      );
      const boldVotes = bucket.items.filter((item) =>
        /bold|black|heavy|semibold|demi/i.test(item.fontName)
      ).length;

      return {
        text: lineText,
        y: bucket.y,
        x: Math.min(...bucket.items.map((item) => Number(item.x || 0))),
        fontSize: Number(fontSize.toFixed(2)),
        bold: boldVotes >= Math.max(1, Math.ceil(bucket.items.length / 2)),
      };
    })
    .filter((line) => line.text);
}

async function sha256Hex(buffer) {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export async function extractPdfLocally(file, onProgress = () => {}) {
  if (!file || file.type !== "application/pdf") {
    throw new Error("Please select a PDF file.");
  }

  if (file.size > 40 * 1024 * 1024) {
    throw new Error("PDF is larger than 40 MB. Compress it before importing.");
  }

  const buffer = await file.arrayBuffer();
  const [pdfjs, fileHash] = await Promise.all([
    // Extraction is entirely browser-side. Keep the large parser in the CDN
    // module graph instead of bundling it into the Cloudflare Worker.
    import(/* webpackIgnore: true */ PDFJS_MODULE_URL),
    sha256Hex(buffer),
  ]);

  pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
  });

  const pdf = await loadingTask.promise;

  if (pdf.numPages > 300) {
    throw new Error("PDF has more than 300 pages. Split it before importing.");
  }

  const pages = [];
  let extractedChars = 0;

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();
    const lines = groupItemsIntoLines(textContent.items || []);

    extractedChars += lines.reduce(
      (sum, line) => sum + line.text.length,
      0
    );

    if (extractedChars > 8_000_000) {
      throw new Error(
        "Extracted PDF text exceeds 8 million characters. Split the PDF into smaller daily files."
      );
    }

    pages.push({
      pageNumber,
      width: Number(viewport.width || 0),
      height: Number(viewport.height || 0),
      lines,
    });

    onProgress({
      pageNumber,
      totalPages: pdf.numPages,
      percent: Math.round((pageNumber / pdf.numPages) * 100),
    });
  }

  return {
    fileName: file.name,
    fileHash,
    fileSize: file.size,
    pageCount: pdf.numPages,
    extractedChars,
    pages,
  };
}
