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

function sentenceLead(value = "", max = 170) {
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
  const lead = sentenceLead(article.why_news || article.seo_description, 170);
  return lead || title || "Latest News";
}

export function repairedCaTitle(article = {}) {
  const title = clean(article.title);
  const body = clean(article.why_news || article.content);
  if (!title || !body) return title;
  const titleIndex = body.toLowerCase().indexOf(title.toLowerCase());
  if (titleIndex > 0 && titleIndex <= 100) {
    const prefix = body.slice(0, titleIndex).trim().replace(/[|:;\-–—]+$/, "").trim();
    const prefixWords = prefix.split(/\s+/).filter(Boolean);
    if (prefix && prefixWords.length <= 12 && !/[.!?]/.test(prefix)) return `${title} ${prefix}`.replace(/\s+/g, " ").trim();
  }
  return title;
}

export function cleanPublicExcerpt(value = "", title = "", limit = 220) {
  let text = clean(value).replace(/^\s*(?:Why\s+in\s+News|What\s+happened|The\s+development)\??\s*[:\-–—]?\s*/i, "").trim();
  const cleanTitle = clean(title);
  if (cleanTitle && text.toLowerCase().startsWith(cleanTitle.toLowerCase())) text = text.slice(cleanTitle.length).replace(/^\s*[:\-–—]?\s*/, "").trim();
  const duplicateIndex = cleanTitle ? text.toLowerCase().indexOf(cleanTitle.toLowerCase()) : -1;
  if (duplicateIndex >= 0 && duplicateIndex < 100) text = text.slice(duplicateIndex + cleanTitle.length).replace(/^\s*[:\-–—]?\s*/, "").trim();
  if (text.length <= limit) return text;
  return text.slice(0, limit).replace(/\s+\S*$/, "").replace(/[,:;\-–—]+$/, "").trim() + "…";
}

export function normalizedPublicCategory(value = "", context = "") {
  const raw = clean(value);
  const v = `${raw} ${clean(context)}`.toLowerCase();
  if (/hydropower|flood|glacier|climate|biodiversity|forest|wildlife|pollution|environment|geography/.test(v)) return "Environment";
  if (/space|nuclear|technology|science|navic|vaccine/.test(v)) return "Science & Technology";
  if (/defence|security|military|missile|drone|vessel|submarine|intelligence/.test(v)) return "Defence & Security";
  if (/international|diplomacy|russia|china|ukraine|g20|sco|world/.test(v)) return "International Relations";
  if (/polity|governance|judiciary|legal|federalism|court|parliament/.test(v)) return "Polity & Governance";
  if (/labour|social security|education|human development|health|jan dhan|e-shram/.test(v)) return "Social Issues";
  if (/agriculture|water resources|fisher|makhana|farm|irrigation|economy|economic|finance|bank|industry|trade|gdp|supply-chain/.test(v)) return "Economy";
  if (/sport|cricket|football|hockey|olympic/.test(v)) return "Sports";
  return raw || "Current Affairs";
}

export function normalizedPaper(value = "") {
  return clean(value)
    .replace(/GS\s*PAPER\s*I\b/gi, "GS-I")
    .replace(/GS\s*PAPER\s*II\b/gi, "GS-II")
    .replace(/GS\s*PAPER\s*III\b/gi, "GS-III")
    .replace(/GS\s*PAPER\s*IV\b/gi, "GS-IV")
    .replace(/\s*,\s*/g, ", ")
    .trim() || "GS";
}
