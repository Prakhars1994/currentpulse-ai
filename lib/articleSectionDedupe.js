const SECTION_ORDER = ["why_news", "syllabus_linkage", "india_relevance", "static_foundation", "data_examples", "prelims", "mains", "answer_framework"];

function signature(value = "") {
  return String(value).toLowerCase().replace(/<[^>]+>/g, " ").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}
function words(value) { return new Set(signature(value).split(" ").filter((word) => word.length > 2)); }
function nearDuplicate(left, right) {
  const a = words(left); const b = words(right);
  if (a.size < 12 || b.size < 12) return false;
  let shared = 0; for (const word of a) if (b.has(word)) shared += 1;
  return shared / Math.min(a.size, b.size) >= 0.9 && Math.max(a.size, b.size) / Math.min(a.size, b.size) <= 1.25;
}
function blocks(value = "") {
  return String(value).replace(/\r\n?/g, "\n").split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
}

export function suppressRepeatedArticleSections(article = {}) {
  const seen = [];
  const result = { ...article };
  for (const field of SECTION_ORDER) {
    const kept = [];
    for (const block of blocks(article[field])) {
      const key = signature(block);
      if (!key || seen.some((prior) => prior.key === key || nearDuplicate(prior.text, block))) continue;
      kept.push(block); seen.push({ key, text: block });
    }
    result[field] = kept.join("\n\n");
  }
  return result;
}
