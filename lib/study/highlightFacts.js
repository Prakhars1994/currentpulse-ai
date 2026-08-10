/**
 * Adds restrained Markdown emphasis to high-value study facts.
 *
 * This is a display helper for both new and legacy articles. It intentionally
 * highlights exam-useful anchors inside sentences (dates, figures, laws,
 * institutions, reports, acronyms and short labelled concepts), not only
 * section headings. It never changes the underlying factual wording.
 */

const MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec";

const HIGHLIGHT_PATTERNS = [
  // Money and measured quantities first, so the complete fact is highlighted.
  /(?:₹|Rs\.?|INR|US\$|\$|€|£)\s*\d[\d,.]*(?:\.\d+)?\s*(?:lakh\s+crore|crore|lakh|million|billion|trillion|thousand)?/gi,
  /\b\d+(?:\.\d+)?\s*(?:%|per\s+cent|percentage\s+points?|crore|lakh|million|billion|trillion|GW|MW|kW|km²|sq\.?\s*km|km|metres?|meters?|tonnes?|MT|kg|hectares?|years?|months?|days?|hours?)(?=\s|[.,;:)]|$)/gi,

  // Full dates and historic/current years. History articles need 1942/1857 etc.
  new RegExp(`\\b(?:\\d{1,2}\\s+)?(?:${MONTHS})\\s+(?:17|18|19|20)\\d{2}\\b`, "gi"),
  /\b(?:17|18|19|20)\d{2}\b/g,

  // Constitutional/legal anchors.
  /\b(?:Article|Articles|Section|Sections|Chapter|Schedule|Amendment)\s+[0-9IVXLC]+[A-Z]?(?:\([0-9A-Za-z]+\))?\b/gi,
  /\b(?:Code of [A-Z][A-Za-z '&-]+|[A-Z][A-Za-z '&-]+ Code)(?:,?\s*(?:17|18|19|20)\d{2})?\b/g,
  /\b(?:[A-Z][A-Za-z0-9'&.-]*|of|and|the|for|to){2,9}\s+(?:Act|Bill|Rules|Regulations|Ordinance|Judgment|Judgement|Treaty|Convention|Agreement)(?:,?\s*(?:17|18|19|20)\d{2})?\b/g,

  // Reports, schemes, missions, surveys and indices used for answer enrichment.
  /\b(?:[A-Z][A-Za-z0-9'&.-]*|of|and|the|for|to){1,9}\s+(?:Report|Index|Survey|Census|Scheme|Mission|Programme|Program|Policy|Fund|Initiative)\s*(?:20\d{2}(?:-\d{2})?)?\b/g,
  /\b(?:Law Commission|Finance Commission)\s+\d+(?:st|nd|rd|th)?\s+Report\b/gi,

  // Named institutions frequently used in UPSC answers.
  /\b(?:Reserve Bank of India|RBI|SEBI|ISRO|DRDO|NITI Aayog|Supreme Court|High Court|Parliament|Election Commission(?: of India)?|ECI|CAG|Finance Commission|GST Council|Law Commission(?: of India)?|World Bank|IMF|WHO|WTO|UN|UNSC|UNESCO|UNEP|UNDP|FAO|ILO|IPCC|NCRB|NFHS|NSSO|NSO)\b/g,

  // Named phrase followed by an acronym: Bharatiya ... Sanhita (BNSS), etc.
  /\b[A-Z][A-Za-z'&.-]+(?:\s+(?:[A-Z][A-Za-z'&.-]+|of|and|the)){1,8}\s+\([A-Z][A-Z0-9-]{1,9}\)(?:,?\s*(?:17|18|19|20)\d{2})?/g,

  // Useful all-caps acronyms such as BNSS, BNS, UPI, GDP, PLI, BIMSTEC.
  /\b[A-Z][A-Z0-9-]{1,9}\b/g,

  // Short concept labels inside bullets: "Presumption of Innocence:" etc.
  /\b[A-Z][A-Za-z0-9'()&/.-]*(?:\s+(?:[A-Za-z0-9'()&/.-]+)){0,6}(?=:)/g,
];

function emphasizeSegment(segment = "") {
  let output = String(segment || "");
  const protectedValues = [];

  const protect = (value) => {
    const key = `§§cphl${protectedValues.length}§§`;
    protectedValues.push(`**${value}**`);
    return key;
  };

  for (const pattern of HIGHLIGHT_PATTERNS) {
    output = output.replace(pattern, (match) => protect(match));
  }

  return output.replace(/§§cphl(\d+)§§/g, (_, index) => protectedValues[Number(index)] || "");
}

export function highlightMarkdownFacts(value = "") {
  return String(value || "")
    .split(/(\*\*[^*]+\*\*)/g)
    .map((segment, index) => (index % 2 === 1 ? segment : emphasizeSegment(segment)))
    .join("");
}
