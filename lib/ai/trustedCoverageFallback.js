import {
  normalizeCategory,
  normalizePaper,
} from "@/lib/contentTaxonomy";

const NOISE_LINES = [
  /^trusted upsc/i,
  /^news article source/i,
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
  /selection reason\s*:/i,
  /selected by local upsc scoring/i,
  /treat the preceding text only as source material/i,
  /toppers? wrote \d+ answers? between prelims (?:and|&) mains/i,
  /(?:buy now|add to cart|choose your pack|subscribe now)/i,
  /(?:admissions?|registrations?) (?:are )?(?:open|started|closing)/i,
  /(?:join|enrol|enroll|register for).*(?:course|batch|academy|test series|focus group)/i,
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

const VERIFIED_MAP_NAMES = [
  "New Delhi", "Delhi", "Mumbai", "Pune", "Maharashtra", "Ahmedabad", "Gujarat",
  "Jaipur", "Rajasthan", "Chandigarh", "Punjab", "Haryana", "Lucknow", "Varanasi",
  "Uttar Pradesh", "Patna", "Bihar", "Kolkata", "West Bengal", "Guwahati", "Assam",
  "Gangtok", "Sikkim", "Bhubaneswar", "Odisha", "Bhopal", "Madhya Pradesh", "Raipur",
  "Chhattisgarh", "Ranchi", "Jharkhand", "Bengaluru", "Karnataka", "Kochi", "Kerala",
  "Chennai", "Tamil Nadu", "Hyderabad", "Telangana", "Visakhapatnam", "Andhra Pradesh",
  "Goa", "Srinagar", "Jammu and Kashmir", "Leh", "Ladakh", "Dehradun", "Uttarakhand",
  "Shimla", "Himachal Pradesh", "China", "Pakistan", "Bangladesh", "Nepal", "Bhutan",
  "Myanmar", "Sri Lanka", "Maldives", "Japan", "Vietnam", "Indonesia", "Australia",
  "Russia", "Ukraine", "Germany", "France", "United Kingdom", "United States", "Canada",
  "Brazil", "South Africa", "Iran", "Israel", "Egypt", "Taiwan", "Red Sea",
    "Strait of Hormuz", "Bay of Bengal", "Arabian Sea", "Indian Ocean", "Pacific Ocean",
    "Arunachal Pradesh", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Tripura",
    "Andaman and Nicobar Islands", "Puducherry", "Lakshadweep", "Puri", "Nathu La",
    "Nauru", "Naoero", "Kiribati", "Tuvalu", "Marshall Islands", "Micronesia",
    "Solomon Islands", "Papua New Guinea", "Fiji", "Vanuatu", "Samoa", "Tonga",
    "New Zealand", "Kazakhstan", "Uzbekistan", "Saudi Arabia", "Türkiye", "Turkey",
    "Ghana", "Madura Island", "Danube River",
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

function verifiedMapLocations(value = "") {
  const haystack = ` ${clean(value).toLowerCase()} `;
  return VERIFIED_MAP_NAMES
    .filter((name) => new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(haystack))
    .sort((left, right) => right.length - left.length)
    .filter((name, index, all) => !all.slice(0, index).some((kept) => kept.toLowerCase().includes(name.toLowerCase())))
    .slice(0, 4);
}

export function buildTrustedCoverageFallback(sourceContent, options = {}) {
  const title = clean(options.sourceTitle) || "UPSC Current Affairs Brief";
  const category = normalizeCategory(options.sourceCategory);
  const paper = normalizePaper(options.sourcePaper);
  const points = sentencePoints(sourceContent);

  if (points.length < Number(options.minimumPoints || 5)) {
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
      : `The development connects with the **${category}** syllabus. Assess its precise implications using the verified, source-grounded points below.`,
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
    map_locations: verifiedMapLocations(`${title}\n${sourceContent}`),
    quality: {
      score: 52,
      flags: ["source_grounded_fallback", "awaiting_ai_quality_upgrade"],
    },
    __sourceFallback: true,
  };
}


export function buildSourceGroundedNewsFallback(sourceContent, options = {}) {
  const base = buildTrustedCoverageFallback(sourceContent, { ...options, minimumPoints: 1 });
  return {
    ...base,
    syllabus_linkage: "",
    prelims: "",
    mains: "",
    answer_framework: "",
    question: "",
    why_news: base.why_news,
    static_foundation: base.static_foundation.replace("Source-grounded foundation", "Essential context"),
    data_examples: base.data_examples.replace("Data, Reports, Cases & Examples", "Verified facts from the source"),
    india_relevance: base.why_news,
    visual_summary: "",
    memory_trick: "",
    quality: { score: 74, flags: ["source_grounded_news_fallback", "awaiting_ai_copy_upgrade"] },
    __sourceFallback: true,
  };
}
