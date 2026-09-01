import {
  classifyCategory,
  classifyNewsCategory,
} from "@/lib/contentTaxonomy";

const SECTION_RULES = [
  ["why_news", /^(?:why\s+in\s+news|in\s+news|context|what\s+happened|the\s+development)\s*:?\s*$/i],
  ["static_foundation", /^(?:background|static\s+foundation|about|overview|context\s+and\s+background)\s*:?\s*$/i],
  ["data_examples", /^(?:key\s+facts?|important\s+facts?|data|examples?|at\s+a\s+glance|highlights?)\s*:?\s*$/i],
  ["prelims", /^(?:prelims?|prelims\s+focus|prelims\s+facts?|for\s+prelims)\s*:?\s*$/i],
  ["mains", /^(?:mains?|mains\s+perspective|analysis|significance|issues?|challenges?|way\s+forward|for\s+mains)\s*:?\s*$/i],
  ["question", /^(?:(?:prelims\s+)?practice\s+question|mcq|mains\s+question|question|possible\s+question|probable\s+mains\s+question)\s*:?\s*$/i],
  ["india_relevance", /^(?:india\s+relevance|why\s+it\s+matters|relevance\s+for\s+india|implications?\s+for\s+india)\s*:?\s*$/i],
];

const NON_ARTICLE_HEADINGS = [
  /^contents?$/i,
  /^index$/i,
  /^current\s+affairs$/i,
  /^news$/i,
  /^daily\s+news$/i,
  /^table\s+of\s+contents$/i,
  /^page\s+\d+$/i,
  /^(?:why\s+in\s+news|background|key\s+facts?|prelims?|mains?|analysis|way\s+forward|question)$/i,
  /^currentpulse\s+ai$/i,
  /^open\s+currentpulse\s+ai\b/i,
  /^today['’]?s\s+\d+$/i,
  /^how\s+to\s+use\s+this\s+\d+-page\s+brief$/i,
  /^\d{1,2}\s+[a-z]{3,9}\s+20\d{2}\s+topic\s+mix$/i,
  /^news\s+static\s*\+\s*evidence\s+prelims\s*\+\s*mains$/i,
  /^related\s+upsc\s+pyq$/i,
];

const PAPER_BY_CATEGORY = {
  "History & Culture": "GS-1",
  Geography: "GS-1",
  "Social Issues": "GS-2",
  "Polity & Governance": "GS-2",
  "International Relations": "GS-2",
  "Government Schemes": "GS-2",
  Economy: "GS-3",
  "Science & Technology": "GS-3",
  Environment: "GS-3",
  "Defence & Security": "GS-3",
  Sports: "Prelims",
  "General News": "Prelims",
};

function rawText(value = "") {
  return String(value ?? "").replace(/\u0000/g, "");
}

function matchText(value = "") {
  return rawText(value)
    .replace(/\u00ad/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function normalizeKey(value = "") {
  return matchText(value)
    .toLowerCase()
    .replace(/\d+/g, "#")
    .replace(/[^a-z#]+/g, " ")
    .trim();
}

function median(values = []) {
  const sorted = values
    .map(Number)
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);

  if (!sorted.length) return 10;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function isSectionHeading(text = "") {
  return SECTION_RULES.some(([, pattern]) => pattern.test(matchText(text)));
}

function looksLikeSentence(text = "") {
  const value = matchText(text);
  if (!value) return false;
  if (/[.!?]["')\]]?$/.test(value) && value.split(/\s+/).length >= 8) return true;
  return value.length > 170;
}

function titleCaseSignal(text = "") {
  const words = matchText(text).split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 18) return false;

  const eligible = words.filter((word) => /[A-Za-z]/.test(word));
  if (!eligible.length) return false;

  const titled = eligible.filter(
    (word) =>
      /^[A-Z][A-Za-z0-9&'/-]*$/.test(word) ||
      /^[A-Z0-9&/-]{2,}$/.test(word)
  ).length;

  return titled / eligible.length >= 0.55;
}

function isLikelyArticleTitle(line, bodyFont, gapBefore = 0) {
  const text = matchText(line?.text);
  if (!text || text.length < 7 || text.length > 180) return false;
  if (NON_ARTICLE_HEADINGS.some((pattern) => pattern.test(text))) return false;
  if (isSectionHeading(text) || looksLikeSentence(text)) return false;
  if (/^(?:©|copyright|www\.|https?:\/\/)/i.test(text)) return false;

  const words = text.split(/\s+/).length;
  const large = Number(line.fontSize || 0) >= bodyFont * 1.17;
  const veryLarge = Number(line.fontSize || 0) >= bodyFont * 1.34;
  const numbered = /^(?:\d{1,3}[.)]|[IVXLC]{1,6}[.)]|[A-Z][.)])\s+\S/.test(text);
  const strongCase = titleCaseSignal(text);
  const allCaps =
    words >= 2 &&
    words <= 14 &&
    text === text.toUpperCase() &&
    /[A-Z]/.test(text);
  const separated = gapBefore >= bodyFont * 0.7;

  return (
    veryLarge ||
    (large && words <= 20) ||
    (line.bold && strongCase && words <= 18) ||
    (numbered && (line.bold || large || strongCase)) ||
    (allCaps && (line.bold || separated))
  );
}

function repeatedBoilerplateKeys(pages = []) {
  const counts = new Map();

  for (const page of pages) {
    const seen = new Set();

    for (const line of page.lines || []) {
      const key = normalizeKey(line.text);
      if (!key || key.length < 4 || key.length > 90) continue;

      const nearTop =
        Number(page.height || 0) > 0 &&
        Number(line.y || 0) >= Number(page.height) * 0.88;
      const nearBottom =
        Number(page.height || 0) > 0 &&
        Number(line.y || 0) <= Number(page.height) * 0.12;

      if (nearTop || nearBottom) seen.add(key);
    }

    for (const key of seen) {
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }

  const threshold = Math.max(3, Math.ceil(pages.length * 0.55));
  return new Set(
    [...counts.entries()]
      .filter(([, count]) => count >= threshold)
      .map(([key]) => key)
  );
}

function cleanDocumentLines(pages = []) {
  const boilerplate = repeatedBoilerplateKeys(pages);
  const rows = [];
  let removedBoilerplate = 0;

  for (const page of pages) {
    const lines = page.lines || [];

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const text = rawText(line.text);
      if (!matchText(text)) continue;

      const normalized = normalizeKey(text);
      const isPageNumber = /^(?:page\s*)?\d{1,4}(?:\s*of\s*\d{1,4})?$/i.test(
        matchText(text)
      );

      if (isPageNumber || boilerplate.has(normalized)) {
        removedBoilerplate += 1;
        continue;
      }

      const previous = lines[index - 1];
      const rawGap = previous
        ? Math.max(0, Number(previous.y || 0) - Number(line.y || 0))
        : 999;

      rows.push({
        ...line,
        text,
        pageNumber: page.pageNumber,
        gapBefore: rawGap,
      });
    }
  }

  return { rows, removedBoilerplate };
}

function sectionFieldFor(text = "") {
  return SECTION_RULES.find(([, pattern]) =>
    pattern.test(matchText(text))
  )?.[0] || "";
}

function joinLines(lines = []) {
  return lines.map(rawText).filter((line) => matchText(line)).join("\n");
}

function splitIntoSections(bodyLines = []) {
  const sections = {
    why_news: [],
    static_foundation: [],
    data_examples: [],
    prelims: [],
    mains: [],
    question: [],
    india_relevance: [],
    unassigned: [],
  };

  let active = "unassigned";

  for (const line of bodyLines) {
    const nextField = sectionFieldFor(line);
    if (nextField) {
      active = nextField;
      continue;
    }
    sections[active].push(rawText(line));
  }

  return Object.fromEntries(
    Object.entries(sections).map(([key, value]) => [key, joinLines(value)])
  );
}

function buildFields(bodyLines, stream) {
  const fullText = joinLines(bodyLines);
  const sections = splitIntoSections(bodyLines);
  const fallbackLead = fullText.slice(0, 900);

  if (stream === "news") {
    return {
      fullText,
      why_news: sections.why_news || fallbackLead,
      static_foundation: sections.static_foundation,
      data_examples: sections.data_examples || sections.prelims,
      india_relevance: sections.india_relevance || sections.mains,
      prelims: "",
      mains: "",
      question: sections.question,
    };
  }

  return {
    fullText,
    why_news: sections.why_news || fallbackLead,
    static_foundation: sections.static_foundation,
    data_examples: sections.data_examples,
    prelims: sections.prelims,
    mains: sections.mains,
    question: sections.question,
    india_relevance: sections.india_relevance,
  };
}

function titleFromFilename(fileName = "") {
  return (
    matchText(fileName)
      .replace(/\.pdf$/i, "")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim() || "Imported PDF"
  );
}

function normalizeTitle(value = "") {
  return matchText(value)
    .replace(/^(?:\d{1,3}[.)]|[IVXLC]{1,6}[.)])\s+/i, "")
    .replace(/\s*[-–—]\s*$/, "")
    .slice(0, 180);
}

function tagsFor(category, paper, stream) {
  return [
    ...new Set(
      [
        category,
        paper,
        stream === "news" ? "News" : "Current Affairs",
        "PDF Import",
      ].filter(Boolean)
    ),
  ];
}

function buildDraft(segment, stream, index) {
  const title = normalizeTitle(segment.title);
  const fields = buildFields(segment.bodyLines, stream);
  const classificationText = `${title}\n${fields.fullText.slice(0, 5000)}`;
  const category = stream === "news"
    ? classifyNewsCategory(classificationText)
    : classifyCategory(classificationText);
  const paper = PAPER_BY_CATEGORY[category] || "Prelims";

  return {
    importIndex: index,
    title,
    category,
    paper,
    tags: tagsFor(category, paper, stream),
    ...fields,
    seo_title: title,
    seo_description: matchText(fields.why_news || fields.fullText).slice(0, 160),
  };
}

function parseStrictMarkerDrafts(rows, stream) {
  const text = rows.map((row) => rawText(row.text)).join("\n");
  const hasMarkers = /\[\[CA_(?:START|END)\]\]/i.test(text);
  if (!hasMarkers) return null;

  if (stream !== "ca" && stream !== "ca_hi") {
    throw new Error(
      "Invalid CurrentPulse CA PDF format. No safe article boundaries detected."
    );
  }

  const starts = [...text.matchAll(/\[\[CA_START\]\]/gi)];
  const ends = [...text.matchAll(/\[\[CA_END\]\]/gi)];
  const malformed =
    !starts.length ||
    starts.length !== ends.length ||
    starts.some(
      (start, index) =>
        start.index >= ends[index].index ||
        (starts[index + 1] && starts[index + 1].index < ends[index].index)
    );

  if (malformed) {
    throw new Error(
      "Invalid CurrentPulse CA PDF format. No safe article boundaries detected."
    );
  }

  const drafts = [];

  for (let index = 0; index < starts.length; index += 1) {
    const block = text.slice(
      starts[index].index + starts[index][0].length,
      ends[index].index
    );
    const lines = block.split(/\r?\n/);
    const metadata = {};
    let bodyStart = 0;

    for (; bodyStart < lines.length; bodyStart += 1) {
      const line = lines[bodyStart].trim();
      const match = line.match(
        /^CA_(TITLE|CATEGORY|GS|DATE|IMAGE)\s*:\s*(.*)$/i
      );
      if (!match) {
        if (!line) continue;
        break;
      }
      metadata[match[1].toLowerCase()] = match[2].trim();
    }

    if (!metadata.title) {
      throw new Error(
        "Invalid CurrentPulse CA PDF format. No safe article boundaries detected."
      );
    }

    const body = lines.slice(bodyStart).join("\n").replace(/^\n+|\n+$/g, "");
    const draft = buildDraft(
      {
        title: metadata.title,
        bodyLines: body ? body.split(/\r?\n/) : [],
      },
      stream,
      index
    );

    draft.title = normalizeTitle(metadata.title);
    draft.category = metadata.category || draft.category;
    draft.paper = metadata.gs || draft.paper;
    draft.date = metadata.date || "";
    draft.image = metadata.image || "NO";
    draft.fullText = body;
    draft.why_news = body;
    draft.static_foundation = "";
    draft.data_examples = "";
    draft.prelims = "";
    draft.mains = "";
    draft.question = "";
    draft.india_relevance = "";
    draft.seo_description = matchText(body).slice(0, 160);
    draft.tags = tagsFor(draft.category, draft.paper, stream);
    drafts.push(draft);
  }

  return drafts;
}

export function buildPdfImportPreview({
  stream,
  fileName,
  fileHash,
  pages,
} = {}) {
  if (!["ca", "ca_hi", "news"].includes(stream)) {
    throw new Error("PDF import stream must be ca, ca_hi or news.");
  }

  if (!Array.isArray(pages) || !pages.length) {
    throw new Error("No extractable PDF pages were found.");
  }

  const { rows, removedBoilerplate } = cleanDocumentLines(pages);
  const strictDrafts = parseStrictMarkerDrafts(rows, stream);

  if (strictDrafts) {
    return {
      stream,
      fileName,
      fileHash,
      bodyFont: 0,
      drafts: strictDrafts,
      stats: {
        pages: pages.length,
        articlesDetected: strictDrafts.length,
        extractedChars: rows.reduce(
          (sum, line) => sum + rawText(line.text).length,
          0
        ),
        preservedChars: strictDrafts.reduce(
          (sum, article) => sum + article.fullText.length + article.title.length,
          0
        ),
        removedBoilerplate,
        zeroAi: true,
      },
    };
  }

  const bodyFont = median(
    rows
      .filter((line) => matchText(line.text).length >= 25)
      .map((line) => line.fontSize)
  );

  const segments = [];
  let active = null;
  const preamble = [];

  for (const line of rows) {
    const titleCandidate = isLikelyArticleTitle(
      line,
      bodyFont,
      Number(line.gapBefore || 0)
    );

    if (titleCandidate) {
      if (active) segments.push(active);
      active = { title: rawText(line.text), bodyLines: [] };
      continue;
    }

    if (!active) preamble.push(rawText(line.text));
    else active.bodyLines.push(rawText(line.text));
  }

  if (active) segments.push(active);

  const usableSegments = segments.filter(
    (segment) => joinLines(segment.bodyLines).trim().length >= 80
  );

  if (!usableSegments.length) {
    usableSegments.push({
      title: titleFromFilename(fileName),
      bodyLines: rows.map((line) => rawText(line.text)),
    });
  }

  const drafts = usableSegments.map((segment, index) =>
    buildDraft(segment, stream, index)
  );

  return {
    stream,
    fileName,
    fileHash,
    bodyFont,
    drafts,
    stats: {
      pages: pages.length,
      articlesDetected: drafts.length,
      extractedChars: rows.reduce(
        (sum, line) => sum + rawText(line.text).length,
        0
      ),
      preservedChars: drafts.reduce(
        (sum, article) => sum + article.fullText.length + article.title.length,
        0
      ),
      removedBoilerplate,
      preambleChars: joinLines(preamble).length,
      zeroAi: true,
    },
  };
}
