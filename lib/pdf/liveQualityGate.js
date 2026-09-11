export const CA_PDF_LIVE_QUALITY_GATE_VERSION = 5;

export const CA_PDF_REQUIRED_LIVE_SECTIONS = Object.freeze([
  "FAST READ",
  "WHY IN NEWS",
  "TOP DATA & FACTS",
  "PRELIMS",
  "QUICK REVISION",
  "PROBABLE OBJECTIVE QUESTION",
  "PROBABLE MAINS QUESTION",
  "MODEL ANSWER (~300 WORDS)",
  "SOURCES",
]);

const normalizeGateText = (text = "") => String(text || "")
  .replace(/\r\n?/g, "\n")
  .replace(/MODEL ANSWER\s*[-–—]\s*(?:ABOUT\s+)?~?\s*300\s+WORDS/gi, "MODEL ANSWER (~300 WORDS)")
  .replace(/Ask CurrentPulse AI\s*[-–—]\s*Prelims/gi, "Ask CurrentPulse AI: Prelims")
  .replace(/Ask CurrentPulse AI\s*[-–—]\s*Mains/gi, "Ask CurrentPulse AI: Mains");

const section = (text = "", start, end) => {
  const source = String(text || "");
  const from = source.indexOf(start);
  if (from < 0) return "";
  const bodyStart = from + start.length;
  if (!end) return source.slice(bodyStart);
  const to = source.indexOf(end, bodyStart);
  return source.slice(bodyStart, to < 0 ? source.length : to);
};

const bulletCount = (text = "") => (String(text || "").match(/^[-•]\s+/gm) || []).length;
const wordCount = (text = "") => String(text || "")
  .replace(/https?:\/\/\S+/g, " ")
  .replace(/[#*_[\]()`>:—–-]+/g, " ")
  .trim()
  .split(/\s+/)
  .filter(Boolean).length;

const headingCount = (text = "") => (String(text || "").match(/^###\s+\S.+$/gm) || []).length;

export function auditCaPdfLiveArticle(markdown = "") {
  const text = normalizeGateText(markdown);
  const problems = [];

  for (const heading of CA_PDF_REQUIRED_LIVE_SECTIONS) {
    if (!text.includes(heading)) problems.push(`Missing section: ${heading}`);
  }

  const facts = section(text, "TOP DATA & FACTS", "PRELIMS");
  const prelims = section(text, "PRELIMS", "QUICK REVISION");
  const quick = section(text, "QUICK REVISION", "PROBABLE OBJECTIVE QUESTION");
  const mains = section(text, "MODEL ANSWER (~300 WORDS)", "Ask CurrentPulse AI: Mains");
  const sources = section(text, "SOURCES");

  // CurrentPulse's editorial contract is 5-6+ strong data points and a compact
  // exam-focused Prelims block. Do not reject otherwise-good PDFs because a
  // template happens to use 6 facts or 3 dense Prelims bullets instead of 8/6.
  if (bulletCount(facts) < 6) problems.push("TOP DATA & FACTS needs at least 6 useful bullets");
  if (bulletCount(prelims) < 3) problems.push("PRELIMS needs at least 3 exam-oriented bullets");
  if (quick.replace(/[#*\-•\s]/g, "").length < 80) problems.push("QUICK REVISION is too thin");

  if (/^[-•]\s+\*\*[^*]*(?:lens|angle|challenge):\*\*/gim.test(prelims)) {
    problems.push("PRELIMS contains a renderer-colliding bullet label; rename lens/angle/challenge labels");
  }

  const mainsWords = wordCount(mains);
  if (mainsWords < 250 || mainsWords > 380) problems.push(`Mains answer should be about 300 words (250-380 accepted); found ${mainsWords}`);
  if (headingCount(mains) < 4) problems.push("Mains answer needs at least four explicit analytical subheadings");
  if (!/^###\s+INTRODUCTION$/mi.test(mains)) problems.push("Mains answer needs an INTRODUCTION heading");
  if (!/^###\s+(ACTIONABLE ROADMAP|WAY FORWARD)$/mi.test(mains)) problems.push("Mains answer needs an actionable way-forward section");
  if (!/^###\s+(FINAL TAKEAWAY|CONCLUSION)$/mi.test(mains)) problems.push("Mains answer needs a conclusion/final takeaway section");
  if (/^ANALYTICAL DIMENSIONS$/mi.test(mains) || /^###\s+ANALYTICAL DIMENSIONS$/mi.test(mains)) problems.push("Generic ANALYTICAL DIMENSIONS heading is not allowed; use a topic-specific analytical heading");
  if (/^(WHY TAXONOMY MATTERS|GOVERNANCE CHALLENGES|STRATEGIC VALUE FOR INDIA|ECONOMIC SIGNIFICANCE|SCIENTIFIC PROMISE|PUBLIC-HEALTH DIMENSION|RISKS OF POORLY DESIGNED DEREGULATION)$/m.test(mains)) problems.push("Bare Mains subheading detected; all Mains subheads must be explicit markdown headings");

  const options = ["(a)", "(b)", "(c)", "(d)"].filter((option) => text.includes(option)).length;
  if (options !== 4) problems.push("MCQ must contain four visible options");
  if (!text.includes("Answer:") || !text.includes("Explanation:")) problems.push("MCQ answer/explanation missing");
  if (!text.includes("Ask CurrentPulse AI: Prelims") || !text.includes("Ask CurrentPulse AI: Mains")) problems.push("CurrentPulse AI links missing");

  if (!/(PIB|TRAI|MoSPI|Ministry|Government|official|CMLRE|ISA|NITI|RBI|SEBI|ISRO|MEA|MoEFCC|MNRE|Press Information Bureau)/i.test(sources)) {
    problems.push("Official source authority missing");
  }
  if (!/https?:\/\//i.test(sources)) problems.push("Official source must include a clickable URL");

  // Reject extraction artefacts and duplicated import metadata. These are formatting
  // failures, not editorial failures, and should be fixed once in the importer.
  if (/Category\s+GS\s+Date\s+Quick rule/i.test(text)) problems.push("PDF page chrome leaked into article");
  if (/^CA_(?:TITLE|CATEGORY|GS|DATE|IMAGE)\s*:/gim.test(text) || /\[\[CA_(?:START|END)\]\]/i.test(text)) {
    problems.push("PDF import metadata leaked into article body");
  }
  if (/Use a measurable implementation framework|Governance lens:|UPSC answer technique:/i.test(text)) problems.push("Generic filler detected");
  if (/\\n/.test(text)) problems.push("Literal \\n extraction artifact detected");

  const score = problems.length === 0 ? 100 : Math.max(0, 100 - problems.length * 15);
  return {
    ok: problems.length === 0,
    score,
    problems,
    metrics: {
      factsBullets: bulletCount(facts),
      prelimsBullets: bulletCount(prelims),
      mainsWords,
      mainsSubheads: headingCount(mains),
    },
  };
}

export function assertCaPdfLiveQuality(markdown = "") {
  const audit = auditCaPdfLiveArticle(markdown);
  if (!audit.ok) throw new Error(`CA PDF live quality gate failed: ${audit.problems.join("; ")}`);
  return audit;
}
