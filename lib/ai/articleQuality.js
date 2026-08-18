function text(value = "") {
  return String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function words(value = "") {
  return text(value).split(/\s+/).filter(Boolean).length;
}

function count(value = "", expression) {
  return (String(value || "").match(expression) || []).length;
}

function scoreFromFlags(flags, penalty = 7) {
  return Math.max(0, 100 - flags.length * penalty);
}

const EDITORIAL_RESIDUE_PATTERNS = [
  /\b(?:economic_benefit|data_point|institution_name|source_field)\s*:/i,
  /\bdata\s*:\s*(?:year|institution|economic_benefit)\b/i,
  /\binstitution\s*:\s*Indian government\b/i,
  /\beconomic(?:_|\s)benefit\s*:\s*potentially bring economic benefits\b/i,
  /\{\s*["']?(?:institution|economic_benefit|data_point)["']?\s*:/i,
];

function hasEditorialResidue(value = "") {
  return EDITORIAL_RESIDUE_PATTERNS.some((pattern) => pattern.test(String(value || "")));
}

const REPETITION_STOP_WORDS = new Set([
  "about", "after", "also", "among", "because", "been", "being", "between", "could", "from",
  "have", "into", "more", "most", "other", "should", "their", "there", "these", "they", "this",
  "through", "under", "which", "while", "with", "would", "india", "indian", "current", "affairs",
]);

function tokenSet(value = "") {
  return new Set(
    text(value)
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 4 && !REPETITION_STOP_WORDS.has(token))
  );
}

function similarity(left = "", right = "") {
  if (words(left) < 35 || words(right) < 35) return 0;
  const a = tokenSet(left);
  const b = tokenSet(right);
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const token of a) if (b.has(token)) shared += 1;
  return shared / Math.min(a.size, b.size);
}

function repeatedSectionPairs(article = {}) {
  const sections = [
    ["static", article.static_foundation],
    ["evidence", article.data_examples],
    ["prelims", article.prelims],
    ["mains", article.mains],
    ["answer", article.answer_framework],
  ].filter(([, value]) => words(value) >= 35);
  const repeated = [];
  for (let i = 0; i < sections.length; i += 1) {
    for (let j = i + 1; j < sections.length; j += 1) {
      const score = similarity(sections[i][1], sections[j][1]);
      if (score >= 0.72) repeated.push(`${sections[i][0]}:${sections[j][0]}`);
    }
  }
  return repeated;
}

export function assessNewsQuality(article = {}) {
  const flags = [];
  const all = [article.why_news, article.static_foundation, article.data_examples, article.india_relevance]
    .filter(Boolean)
    .join("\n");
  const totalWords = words(all);
  const bulletCount = count(all, /(?:^|\n)\s*(?:[-*]|\d+[.)])\s+/gm);
  const boldCount = count(all, /\*\*[^*]{2,80}\*\*/g);
  const evidenceCount = count(
    all,
    /\b(?:19|20)\d{2}\b|\b\d+(?:\.\d+)?\s*(?:%|crore|lakh|million|billion|km|mw|gw|tonnes?)\b|\b(?:Act|Article|Report|Index|Committee|Judgment|Convention|Scheme)\b/gi
  );

  if (text(article.why_news).length < 120) flags.push("thin_news_summary");
  if (words(article.static_foundation) < 35) flags.push("thin_context");
  if (bulletCount < 3) flags.push("insufficient_key_points");
  if (totalWords < 180) flags.push("news_too_short");
  if (totalWords > 650) flags.push("news_too_long");
  if (boldCount < 2) flags.push("weak_keyword_emphasis");
  if (hasEditorialResidue(all)) flags.push("editorial_residue");

  const score = scoreFromFlags(flags, 9);
  return {
    passed: score >= 73 && !flags.includes("news_too_short") && !flags.includes("editorial_residue"),
    score,
    flags,
    metrics: { totalWords, bulletCount, boldCount, evidenceCount },
  };
}

export function assessArticleQuality(article = {}, options = {}) {
  const mode = options.mode || "upsc";
  if (mode === "news") return assessNewsQuality(article);

  const flags = [];
  const all = [
    article.why_news,
    article.syllabus_linkage,
    article.india_relevance,
    article.static_foundation,
    article.data_examples,
    article.prelims,
    article.mains,
    article.answer_framework,
  ].join("\n");

  const totalWords = words(all);
  const bulletCount = count(all, /(?:^|\n)\s*(?:[-*]|\d+[.)])\s+/gm);
  const boldCount = count(all, /\*\*[^*]{2,80}\*\*/g);
  const evidenceCount = count(
    article.data_examples || "",
    /\b(?:19|20)\d{2}\b|\b\d+(?:\.\d+)?\s*(?:%|crore|lakh|million|billion|km|mw|gw|tonnes?)\b|\b(?:Act|Article|Report|Index|Committee|Judgment|Convention|Scheme)\b/gi
  );
  const evidenceItemCount = count(
    article.data_examples || "",
    /(?:^|\n)\s*(?:[-*]|\d+[.)])\s+/gm
  );
  const headingCount = count(all, /(?:^|\n)#{2,4}\s+/gm);
  const repetitionPairs = repeatedSectionPairs(article);
  const sourceGroundedFallback =
    Array.isArray(article.quality_flags) &&
    article.quality_flags.includes("source_grounded_fallback");
  const examUtilityWords = words(article.prelims) + words(article.mains) + words(article.answer_framework);

  if (text(article.why_news).length < 80) flags.push("thin_why_news");
  if (words(article.syllabus_linkage) > 90) flags.push("syllabus_too_long");
  if (words(article.static_foundation) < 45) flags.push("thin_static_foundation");
  if (words(article.static_foundation) > 260) flags.push("static_foundation_too_long");
  if (words(article.data_examples) < 40) flags.push("thin_evidence");
  if (words(article.prelims) < 45) flags.push("thin_prelims");
  if (words(article.prelims) > 190) flags.push("prelims_too_long");
  if (words(article.mains) < 160) flags.push("thin_mains");
  if (words(article.answer_framework) < 70) flags.push("thin_answer_framework");
  if (totalWords < 520) flags.push("article_too_short");
  if (totalWords > 1450) flags.push("article_too_long");
  if (bulletCount < 10) flags.push("insufficient_revision_points");
  if (boldCount < 8) flags.push("insufficient_keyword_emphasis");
  if (evidenceItemCount < 5 || evidenceCount < 3) flags.push("insufficient_data_or_examples");
  if (headingCount < 3) flags.push("weak_heading_structure");
  if (examUtilityWords < 280) flags.push("weak_exam_utility");
  if (hasEditorialResidue(all)) flags.push("editorial_residue");
  if (repetitionPairs.length >= 2 && !sourceGroundedFallback) flags.push("repetitive_sections");

  const score = scoreFromFlags(flags, 7);
  return {
    passed:
      score >= 76 &&
      !flags.includes("article_too_short") &&
      !flags.includes("thin_mains") &&
      !flags.includes("insufficient_data_or_examples") &&
      !flags.includes("editorial_residue") &&
      !flags.includes("repetitive_sections") &&
      !flags.includes("weak_exam_utility"),
    score,
    flags,
    metrics: {
      totalWords,
      bulletCount,
      boldCount,
      evidenceCount,
      evidenceItemCount,
      headingCount,
      examUtilityWords,
      repetitionPairs,
    },
  };
}
