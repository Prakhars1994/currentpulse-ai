function text(value = "") {
  return String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function words(value = "") {
  return text(value).split(/\s+/).filter(Boolean).length;
}

function count(value = "", expression) {
  return (String(value || "").match(expression) || []).length;
}

export function assessArticleQuality(article = {}) {
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
  const evidenceCount = count(all, /\b(?:19|20)\d{2}\b|\b\d+(?:\.\d+)?\s*(?:%|crore|lakh|million|billion|km|mw|gw|tonnes?)\b|\b(?:Act|Article|Report|Index|Committee|Judgment|Convention|Scheme)\b/gi);
  const headingCount = count(all, /(?:^|\n)#{2,4}\s+/gm);

  if (text(article.why_news).length < 90) flags.push("thin_why_news");
  if (text(article.syllabus_linkage).length < 90) flags.push("missing_syllabus_linkage");
  if (text(article.india_relevance).length < 80) flags.push("missing_india_relevance");
  if (words(article.static_foundation) < 110) flags.push("thin_static_foundation");
  if (words(article.data_examples) < 70) flags.push("thin_evidence");
  if (words(article.prelims) < 130) flags.push("thin_prelims");
  if (words(article.mains) < 230) flags.push("thin_mains");
  if (words(article.answer_framework) < 90) flags.push("thin_answer_framework");
  if (totalWords < 750) flags.push("article_too_short");
  if (bulletCount < 10) flags.push("insufficient_revision_points");
  if (boldCount < 8) flags.push("insufficient_keyword_emphasis");
  if (evidenceCount < 5) flags.push("insufficient_data_or_examples");
  if (headingCount < 4) flags.push("weak_heading_structure");

  const score = Math.max(0, 100 - flags.length * 8);
  return {
    passed: score >= 76 && !flags.includes("article_too_short") && !flags.includes("thin_mains"),
    score,
    flags,
    metrics: { totalWords, bulletCount, boldCount, evidenceCount, headingCount },
  };
}
