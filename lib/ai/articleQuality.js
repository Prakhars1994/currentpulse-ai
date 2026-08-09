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

  const score = scoreFromFlags(flags, 9);
  return {
    passed: score >= 73 && !flags.includes("news_too_short"),
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

  const score = scoreFromFlags(flags, 7);
  return {
    passed:
      score >= 72 &&
      !flags.includes("article_too_short") &&
      !flags.includes("thin_mains") &&
      !flags.includes("insufficient_data_or_examples"),
    score,
    flags,
    metrics: { totalWords, bulletCount, boldCount, evidenceCount, evidenceItemCount, headingCount },
  };
}
