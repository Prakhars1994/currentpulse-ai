function clean(value = "") {
  return String(value || "")
    .replace(/\[\[(?:CA|NEWS)_(?:START|END)\]\]/gi, " ")
    .replace(/\b(?:CA|NEWS)_(?:TITLE|CATEGORY|GS|DATE|IMAGE|SCOPE|SECTION|STYLE)\s*:\s*[^\n\r]*/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function sentenceLead(value = "", max = 110) {
  const text = clean(value);
  if (!text) return "";
  const sentence = text.split(/(?<=[.!?])\s+/)[0] || text;
  const clipped = sentence.length <= max ? sentence : sentence.slice(0, max).replace(/\s+\S*$/, "");
  return clipped.replace(/[,:;\-–—]+\s*$/, "").trim();
}

function looksBrokenNewsTitle(title = "") {
  const text = clean(title);
  const words = text.split(/\s+/).filter(Boolean);
  return !text || words.length <= 2 || /^[a-z]/.test(text) || /^(?:in|as|and|or|but|to|for|with|from|of|on|at|by)\b/i.test(text) || /^\d+\b/.test(text);
}

export function repairedNewsTitle(article = {}) {
  const title = clean(article.title);
  if (!looksBrokenNewsTitle(title)) return title;
  const lead = sentenceLead(article.why_news || article.seo_description, 115);
  if (!lead) return title || "Latest News";
  if (title && lead.toLowerCase().includes(title.toLowerCase())) return lead;
  return lead;
}

export function repairedCaTitle(article = {}) {
  const title = clean(article.title);
  const body = clean(article.why_news || article.content);
  if (!title || !body) return title;

  const titleIndex = body.toLowerCase().indexOf(title.toLowerCase());
  if (titleIndex > 0 && titleIndex <= 100) {
    const prefix = body.slice(0, titleIndex).trim().replace(/[|:;\-–—]+$/, "").trim();
    const prefixWords = prefix.split(/\s+/).filter(Boolean);
    if (prefix && prefixWords.length <= 12 && !/[.!?]/.test(prefix)) {
      return `${title} ${prefix}`.replace(/\s+/g, " ").trim();
    }
  }
  return title;
}

export function cleanPublicExcerpt(value = "", title = "", limit = 220) {
  let text = clean(value)
    .replace(/^\s*(?:Why\s+in\s+News|What\s+happened|The\s+development)\??\s*[:\-–—]?\s*/i, "")
    .trim();
  const cleanTitle = clean(title);
  if (cleanTitle && text.toLowerCase().startsWith(cleanTitle.toLowerCase())) {
    text = text.slice(cleanTitle.length).replace(/^\s*[:\-–—]?\s*/, "").trim();
  }
  const duplicateIndex = cleanTitle ? text.toLowerCase().indexOf(cleanTitle.toLowerCase()) : -1;
  if (duplicateIndex >= 0 && duplicateIndex < 100) {
    text = text.slice(duplicateIndex + cleanTitle.length).replace(/^\s*[:\-–—]?\s*/, "").trim();
  }
  if (text.length <= limit) return text;
  return text.slice(0, limit).replace(/\s+\S*$/, "").replace(/[,:;\-–—]+$/, "").trim() + "…";
}

export function normalizedPublicCategory(value = "") {
  const raw = clean(value);
  const v = raw.toLowerCase();
  if (/science/.test(v) && /(energy|technology|tech|environment)/.test(v)) return "Science & Technology";
  if (/agriculture|water resources|fisher|makhana|farm|irrigation/.test(v)) return "Economy";
  if (/labour|social security|education|human development|health/.test(v)) return "Social Issues";
  if (/polity|governance|judiciary|legal/.test(v)) return "Polity & Governance";
  if (/international|diplomacy|world/.test(v)) return "International Relations";
  if (/defence|security|military/.test(v)) return "Defence & Security";
  if (/environment|climate|biodiversity|geography|forest|wildlife/.test(v)) return "Environment";
  if (/economy|economic|finance|bank|industry|trade/.test(v)) return "Economy";
  return raw || "Current Affairs";
}
