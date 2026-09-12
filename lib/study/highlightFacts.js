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
  /(?:₹|Rs\.?|INR|US\$|\$|€|£)\s*\d[\d,.]*(?:\.\d+)?\s*(?:lakh\s+crore|crore|lakh|million|billion|trillion|thousand)?/gi,
  /\b\d+(?:\.\d+)?\s*(?:%|per\s+cent|percentage\s+points?|crore|lakh|million|billion|trillion|GW|MW|kW|km²|sq\.?\s*km|km|metres?|meters?|tonnes?|MT|kg|hectares?|years?|months?|days?|hours?)(?=\s|[.,;:)]|$)/gi,
  new RegExp(`\\b(?:\\d{1,2}\\s+)?(?:${MONTHS})\\s+(?:17|18|19|20)\\d{2}\\b`, "gi"),
  /\b(?:17|18|19|20)\d{2}\b/g,
  /\b(?:Article|Articles|Section|Sections|Chapter|Schedule|Amendment)\s+[0-9IVXLC]+[A-Z]?(?:\([0-9A-Za-z]+\))?\b/gi,
  /\b(?:Code of [A-Z][A-Za-z '&-]+|[A-Z][A-Za-z '&-]+ Code)(?:,?\s*(?:17|18|19|20)\d{2})?\b/g,
  /\b(?:[A-Z][A-Za-z0-9'&.-]*|of|and|the|for|to){2,9}\s+(?:Act|Bill|Rules|Regulations|Ordinance|Judgment|Judgement|Treaty|Convention|Agreement)(?:,?\s*(?:17|18|19|20)\d{2})?\b/g,
  /\b(?:[A-Z][A-Za-z0-9'&.-]*|of|and|the|for|to){1,9}\s+(?:Report|Index|Survey|Census|Scheme|Mission|Programme|Program|Policy|Fund|Initiative)\s*(?:20\d{2}(?:-\d{2})?)?\b/g,
  /\b(?:Law Commission|Finance Commission)\s+\d+(?:st|nd|rd|th)?\s+Report\b/gi,
  /\b(?:Reserve Bank of India|RBI|SEBI|ISRO|DRDO|ICAR|ICRISAT|NITI Aayog|Supreme Court|High Court|Parliament|Election Commission(?: of India)?|ECI|CAG|Finance Commission|GST Council|Law Commission(?: of India)?|World Bank|IMF|WHO|WTO|UN|UNSC|UNESCO|UNEP|UNDP|FAO|ILO|IPCC|NCRB|NFHS|NSSO|NSO)\b/g,
  /\b[A-Z][A-Za-z'&.-]+(?:\s+(?:[A-Z][A-Za-z'&.-]+|of|and|the)){1,8}\s+\([A-Z][A-Z0-9-]{1,23}\)(?:,?\s*(?:17|18|19|20)\d{2})?/g,
  /\b[A-Z][A-Z0-9-]{1,23}\b/g,
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
  for (const pattern of HIGHLIGHT_PATTERNS) output = output.replace(pattern, (match) => protect(match));
  return output.replace(/§§cphl(\d+)§§/g, (_, index) => protectedValues[Number(index)] || "");
}

/**
 * PDF.js can preserve the logical line breaks while the strict renderer later
 * rejoins unknown Markdown headings or MCQ lines to the previous list item.
 * Repair only those deterministic Markdown boundaries here. This is display-
 * only: factual wording and stored article content remain unchanged.
 */
export function repairCanonicalPdfMarkdown(value = "") {
  let text = String(value || "").replace(/\r\n?/g, "\n");

  // A heading token must never remain inside a list item or paragraph.
  text = text.replace(/[ \t]+(#{2,4})[ \t]+(?=[^\n])/g, "\n\n$1 ");

  // Close numbered-statement paragraphs before the UPSC prompt and keep each
  // MCQ option as its own paragraph even when PDF extraction supplied only a
  // soft line break.
  text = text
    .replace(/[ \t]+(Which of the statements given above is\/are correct\?)/gi, "\n\n$1")
    .replace(/(^|\n)[ \t]*(\([a-d]\)[ \t]+)/gim, "$1\n$2")
    .replace(/[ \t]+(\([a-d]\)[ \t]+)/gim, "\n\n$1")
    .replace(/[ \t]+(\[Ask CurrentPulse AI:\s*(?:Prelims|Mains)\]\([^\n)]+\))/gi, "\n\n$1");

  // Headings and MCQ options need blank-line separation for CommonMark to
  // close the preceding list before ReactMarkdown parses the next block.
  text = text
    .replace(/(^|\n)(#{2,4}\s+[^\n]+)(?=\n(?!\n))/g, "$1$2\n")
    .replace(/(^|\n)(\([a-d]\)[^\n]*)(?=\n(?!\n))/gim, "$1$2\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text;
}

export function highlightMarkdownFacts(value = "") {
  const raw = String(value || "");

  // The administrator CA master format is already intentionally structured.
  // Auto-emphasis on this canonical Markdown can corrupt MCQ statements,
  // monetary ranges, links and answer sections. Preserve its factual text,
  // but repair deterministic block-boundary damage from PDF rendering.
  if (/^##\s+FAST READ\b/im.test(raw) && /(^|\n)##\s+PROBABLE OBJECTIVE QUESTION\b/im.test(raw)) {
    return repairCanonicalPdfMarkdown(raw);
  }

  const protectedMarkdown = [];
  const protectMarkdown = (match) => {
    const key = `§§cpmd${protectedMarkdown.length}§§`;
    protectedMarkdown.push(match);
    return key;
  };

  let protectedValue = raw
    .replace(/\[[^\]]+\]\([^\s)]+(?:\s+"[^"]*")?\)/g, protectMarkdown)
    .replace(/<https?:\/\/[^>]+>/g, protectMarkdown)
    .replace(/`[^`]+`/g, protectMarkdown)
    .replace(/\*\*[^*]+\*\*/g, protectMarkdown);

  protectedValue = emphasizeSegment(protectedValue);

  return protectedValue.replace(/§§cpmd(\d+)§§/g, (_, index) => protectedMarkdown[Number(index)] || "");
}
