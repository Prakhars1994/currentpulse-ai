const STRONG_NUMBER = /\b\d[\d,]*(?:\.\d+)?\s*(?:%|percent|percentage|lakh|crore|million|billion|trillion|sq\.?\s*km|square\s+kilomet(?:er|re)s?|hectares?|km|kilomet(?:er|re)s?|mw|gw|kw|tonnes?|tons?)\b/gi;
const YEAR = /^(?:19|20)\d{2}$/;

const CLASS_RULES = [
  ["households", /\b(?:households?|famil(?:y|ies)|homes?)\b/i],
  ["people", /\b(?:people|persons?|workers?|weavers?|employees?|beneficiar(?:y|ies)|farmers?|students?|women|men|children|citizens?)\b/i],
  ["area", /\b(?:sq\.?\s*km|square\s+kilomet(?:er|re)s?|hectares?|area|spread|covers?)\b/i],
  ["distance", /\b(?:km|kilomet(?:er|re)s?|distance|long|length)\b/i],
  ["power", /\b(?:mw|gw|kw|megawatt|gigawatt|kilowatt|capacity|power)\b/i],
  ["money", /\b(?:₹|rs\.?|rupees?|dollars?|\$|revenue|cost|outlay|budget|fund)\b/i],
];

function normalizeNumber(raw = "") {
  return String(raw)
    .toLowerCase()
    .replace(/,/g, "")
    .replace(/\bpercentage\b/g, "%")
    .replace(/\bpercent\b/g, "%")
    .replace(/\bsquare\s+kilomet(?:er|re)s?\b/g, "sq km")
    .replace(/\bsq\.?\s*km\b/g, "sq km")
    .replace(/\bkilomet(?:er|re)s?\b/g, "km")
    .replace(/\s+/g, " ")
    .trim();
}

function classesFor(context = "") {
  return new Set(
    CLASS_RULES.filter(([, pattern]) => pattern.test(context)).map(([name]) => name)
  );
}

function extract(text = "") {
  const value = String(text || "");
  const found = [];
  for (const match of value.matchAll(STRONG_NUMBER)) {
    const key = normalizeNumber(match[0]);
    const bare = key.replace(/\s.*$/, "");
    if (YEAR.test(bare)) continue;
    const start = Math.max(0, (match.index || 0) - 85);
    const end = Math.min(value.length, (match.index || 0) + match[0].length + 85);
    found.push({ key, raw: match[0], context: value.slice(start, end), classes: classesFor(value.slice(start, end)) });
  }
  return found;
}

function generatedText(article = {}) {
  return [
    article.title, article.why_news, article.syllabus_linkage, article.india_relevance,
    article.static_foundation, article.data_examples, article.prelims, article.mains,
    article.answer_framework, article.question, article.visual_summary, article.memory_trick,
  ].filter(Boolean).join("\n");
}

function sourceText(source = {}) {
  return [
    source.title, source.description, source.content,
    ...(Array.isArray(source.sourceReferences)
      ? source.sourceReferences.flatMap((item) => [item?.sourceTitle, item?.summary, item?.content])
      : []),
  ].filter(Boolean).join("\n");
}

function disjoint(left, right) {
  if (!left.size || !right.size) return false;
  for (const item of left) if (right.has(item)) return false;
  return true;
}

/**
 * Deterministic guard for high-risk numeric facts.  It does not attempt to
 * fact-check the world; it makes sure a source-grounded article does not invent
 * a scaled number, and that a reused number is not silently attached to a
 * different entity class (for example workers -> households).
 */
export function assessNumericFactConsistency(source = {}, article = {}) {
  const sourceFacts = extract(sourceText(source));
  const outputFacts = extract(generatedText(article));
  if (!outputFacts.length) return { allowed: true, code: "no_scaled_numeric_facts" };

  const byKey = new Map();
  for (const fact of sourceFacts) {
    if (!byKey.has(fact.key)) byKey.set(fact.key, []);
    byKey.get(fact.key).push(fact);
  }

  for (const fact of outputFacts) {
    const matches = byKey.get(fact.key) || [];
    if (!matches.length) {
      return {
        allowed: false,
        code: "unsupported_numeric_fact",
        reason: `Generated scaled numeric fact "${fact.raw}" is absent from the retained source material.`,
      };
    }

    if (
      fact.classes.size &&
      matches.every((sourceFact) => sourceFact.classes.size && disjoint(fact.classes, sourceFact.classes))
    ) {
      return {
        allowed: false,
        code: "numeric_entity_mismatch",
        reason: `Generated numeric fact "${fact.raw}" is attached to a different entity/unit context than its source.`,
      };
    }
  }

  return { allowed: true, code: "numeric_facts_source_consistent" };
}
