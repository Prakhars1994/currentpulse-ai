import {
  normalizeCategory,
  normalizePaper,
} from "@/lib/contentTaxonomy";

const NOISE_LINES = [
  /^trusted upsc/i,
  /^source(?: title| url| category| paper)?\s*:/i,
  /^published at\s*:/i,
  /^keywords\s*:/i,
  /^sources consulted/i,
  /^complete extracted source content/i,
  /^this material was selected/i,
  /^do not /i,
  /^preserve every/i,
  /^improve only/i,
  /^new trusted coverage inputs/i,
  /^existing currentpulse article/i,
];

const EMPHASIS_TERMS = [
  "India",
  "Supreme Court",
  "High Court",
  "Parliament",
  "RBI",
  "SEBI",
  "NITI Aayog",
  "United Nations",
  "Constitution",
  "Act",
  "Bill",
  "Report",
  "Scheme",
  "Mission",
];

function clean(value = "") {
  return String(value || "")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\*\*/g, "")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^\s*[-*•]\s*/gm, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractKnowledge(sourceContent) {
  const marker = "COMPLETE EXTRACTED SOURCE CONTENT";
  const markedIndex = sourceContent.lastIndexOf(marker);
  const selectedWithInstructions = markedIndex >= 0
    ? sourceContent.slice(markedIndex + marker.length)
    : sourceContent;
  const selected = selectedWithInstructions.split(
    /\n\s*This material was selected by a trusted UPSC current-affairs publisher\./i
  )[0];

  return selected
    .split(/\n+/)
    .map((line) => clean(line))
    .filter((line) => line.length >= 25)
    .filter((line) => !NOISE_LINES.some((pattern) => pattern.test(line)))
    .join("\n");
}

function sentencePoints(sourceContent) {
  const knowledge = extractKnowledge(sourceContent);
  const candidates = knowledge
    .split(/\n|(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((value) => clean(value).replace(/^\d+[.)]\s*/, ""))
    .filter((value) => value.length >= 35 && value.length <= 360);
  const seen = new Set();

  return candidates.filter((value) => {
    const key = value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function emphasize(value) {
  let text = value;

  for (const term of EMPHASIS_TERMS) {
    const expression = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g");
    text = text.replace(expression, `**${term}**`);
  }

  return text;
}

function bullets(points, start, count) {
  return points
    .slice(start, start + count)
    .map((point) => `- ${emphasize(point)}`)
    .join("\n");
}

function firstEvidence(points) {
  const evidence = points.filter((point) =>
    /\b(?:19|20)\d{2}\b|\d|\b(?:Act|Article|Bill|Report|Index|Committee|Court|Scheme|Mission|Convention|Ministry|Organisation|Organization)\b/i.test(point)
  );
  return (evidence.length ? evidence : points).slice(0, 8);
}

export function buildTrustedCoverageFallback(sourceContent, options = {}) {
  const title = clean(options.sourceTitle) || "UPSC Current Affairs Brief";
  const category = normalizeCategory(options.sourceCategory);
  const paper = normalizePaper(options.sourcePaper);
  const points = sentencePoints(sourceContent);

  if (points.length < 3) {
    throw new Error(
      "Trusted coverage could not be converted safely without AI because the retained source extract is too short."
    );
  }

  const whyPoints = points.slice(0, Math.min(3, points.length));
  const indiaPoints = points.filter((point) => /\bIndia(?:n|'s|’s)?\b/i.test(point));
  const evidence = firstEvidence(points);
  const coreBullets = bullets(points, 0, Math.min(12, points.length));
  const analysisBullets = bullets(points, Math.min(4, points.length - 1), 12) || coreBullets;

  return {
    title,
    category,
    paper,
    why_news: whyPoints.map(emphasize).join(" "),
    syllabus_linkage:
      `- **Prelims:** ${category} — institutions, terminology and factual features connected with the development.\n` +
      `- **Mains:** ${paper} — contemporary application of the relevant syllabus theme.\n` +
      `- **Current–static link:** Revise the underlying institution, policy or concept together with this development.`,
    india_relevance: indiaPoints.length
      ? indiaPoints.slice(0, 4).map(emphasize).join(" ")
      : `The development has been retained because a trusted UPSC current-affairs source connects it with the **${category}** syllabus. Its precise implications should be assessed using the source-grounded points below.`,
    static_foundation:
      `### Source-grounded foundation\n${bullets(points, 2, 10) || coreBullets}`,
    data_examples:
      `### Data, Reports, Cases & Examples\n${evidence.map((point) => `- ${emphasize(point)}`).join("\n")}`,
    prelims:
      `### Key factual points\n${coreBullets}\n\n### Prelims traps\n` +
      `- Distinguish the **immediate development** from the permanent mandate or structure of the institution concerned.\n` +
      `- Revise exact names, dates, locations and legal or institutional terms from the source points; do not infer facts not stated there.`,
    mains:
      `### Background and key dimensions\n${analysisBullets}\n\n` +
      `### Analytical use\n- Connect the development with its institutional, policy, economic, social, environmental or security implications only where supported above.\n` +
      `- In a Mains answer, separate the verified development from broader evaluation and use the named evidence precisely.\n\n` +
      `### Way forward\n- Base recommendations on the gaps and institutional responsibilities identified in the source-grounded points.`,
    answer_framework:
      `### Introduction\nBegin with the immediate development and identify the central institution or policy issue.\n\n` +
      `### Body\n- Explain the relevant static concept.\n- Present the principal source-backed facts.\n- Analyse significance for India and the syllabus theme.\n- Discuss supported challenges or implementation gaps.\n- Use one named law, report, institution, date or example from the evidence box.\n\n` +
      `### Conclusion\nEnd with a balanced, institutionally feasible way forward without making claims beyond the available evidence.`,
    question: `Examine the significance of “${title}”. Discuss its key implications and the way forward.`,
    image_search_query: `${title} India exact institution event Wikimedia Commons`,
    visual_summary:
      `**Trigger:** ${title} → **Core idea:** source-grounded institutional and factual context → **UPSC link:** ${category}, ${paper}`,
    memory_trick: `Remember the sequence **Development → Institution → Evidence → Implication** while revising ${title}.`,
    map_locations: [],
    quality: {
      score: 52,
      flags: ["source_grounded_fallback", "awaiting_ai_quality_upgrade"],
    },
    __sourceFallback: true,
  };
}
