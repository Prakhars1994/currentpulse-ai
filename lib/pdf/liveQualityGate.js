export const CA_PDF_LIVE_QUALITY_GATE_VERSION = 2;

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

export function auditCaPdfLiveArticle(markdown = "") {
  const text = String(markdown || "");
  const problems = [];

  for (const heading of CA_PDF_REQUIRED_LIVE_SECTIONS) {
    if (!text.includes(heading)) problems.push(`Missing section: ${heading}`);
  }

  const facts = section(text, "TOP DATA & FACTS", "PRELIMS");
  const prelims = section(text, "PRELIMS", "QUICK REVISION");
  const quick = section(text, "QUICK REVISION", "PROBABLE OBJECTIVE QUESTION");
  const mains = section(text, "MODEL ANSWER (~300 WORDS)", "Ask CurrentPulse AI: Mains");
  const sources = section(text, "SOURCES");

  if (bulletCount(facts) < 8) problems.push("TOP DATA & FACTS needs at least 8 useful bullets");
  if (bulletCount(prelims) < 6) problems.push("PRELIMS needs at least 6 exam-oriented bullets");
  if (quick.replace(/[#*\-•\s]/g, "").length < 80) problems.push("QUICK REVISION is too thin");

  const mainsWords = wordCount(mains);
  if (mainsWords < 260 || mainsWords > 340) problems.push(`Mains answer should be 260-340 words; found ${mainsWords}`);

  const options = ["(a)", "(b)", "(c)", "(d)"].filter((option) => text.includes(option)).length;
  if (options !== 4) problems.push("MCQ must contain four visible options");
  if (!text.includes("Answer:") || !text.includes("Explanation:")) problems.push("MCQ answer/explanation missing");
  if (!text.includes("Ask CurrentPulse AI: Prelims") || !text.includes("Ask CurrentPulse AI: Mains")) problems.push("CurrentPulse AI links missing");
  if (!/(PIB|TRAI|MoSPI|Ministry|Government|official)/i.test(sources)) problems.push("Official source authority missing");
  if (/Category\s+GS\s+Date\s+Quick rule/i.test(text)) problems.push("PDF page chrome leaked into article");
  if (/Use a measurable implementation framework|Governance lens:|UPSC answer technique:/i.test(text)) problems.push("Generic filler detected");
  if (/\\n/.test(text)) problems.push("Literal \\n extraction artifact detected");

  const score = Math.max(0, 100 - problems.length * 10);
  return { ok: problems.length === 0, score, problems, metrics: { factsBullets: bulletCount(facts), prelimsBullets: bulletCount(prelims), mainsWords } };
}

export function assertCaPdfLiveQuality(markdown = "") {
  const audit = auditCaPdfLiveArticle(markdown);
  if (!audit.ok) throw new Error(`CA PDF live quality gate failed: ${audit.problems.join("; ")}`);
  return audit;
}
