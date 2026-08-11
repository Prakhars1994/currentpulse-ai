import { inspectCoverageCandidate } from "../lib/coverage/sourceSanitizer.js";
import { assessArticleQuality } from "../lib/ai/articleQuality.js";
import { classifyCategoryWithConfidence, correctTaxonomy } from "../lib/contentTaxonomy.js";
import { isSameEvent } from "../lib/news/eventCluster.js";
import { filterRelevantMapLocations } from "../lib/study/mapRelevance.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const junkTitles = [
  "GUIDE : Indian Economy for UPSC Prelims & Mains Examination",
  "Daily Current Affairs Editorials For UPSC Preparation-7 PM Daily Editorial",
  "UPSC Civil Services Examination Interview Transcripts",
  "UPSC Board Members Details",
  "UPSC Interview: Know your state",
  "Source/Reference:",
  "Economy / Social Justice",
  "[RESIDENTIAL] FRC #12 Mains Focus Group Students – Update",
  "Weekly Current Affairs PDF For UPSC",
  "Category: PUBLIC",
  "Defense, Energy, and Labor Technology Updates: Agni-IV, GOBARdhan, and Labor Box",
  "Geographical Indications, Smart Materials, and the New Phase of the Khelo India Scheme",
];
for (const title of junkTitles) {
  const result = inspectCoverageCandidate({
    title,
    url: "https://example.com/blog/item",
    summary: "Generic publisher resource page with preparation navigation and links. ".repeat(5),
  });
  assert(!result.accepted, `Junk title passed sanitation: ${title}`);
}

const valid = inspectCoverageCandidate({
  title: "Cabinet approves GOBARdhan scheme expansion",
  url: "https://example.com/daily-updates/gobardhan",
  summary: "The Union Cabinet approved a national bioenergy measure with implementation details and verified facts. ".repeat(4),
});
assert(valid.accepted, "A normal current-affairs article was rejected.");

const nauruGeo = classifyCategoryWithConfidence(
  "The Republic of Naoero, formerly Nauru, is an island nation in the Pacific Ocean. Its location and capital are relevant for Prelims.",
  "Economy"
);
assert(nauruGeo.category === "Geography", `Nauru geography taxonomy failed: ${nauruGeo.category}`);
const nauruIr = correctTaxonomy(
  "India and Nauru discuss bilateral diplomatic relations and a new agreement.",
  "Economy",
  "GS-3"
);
assert(nauruIr.category === "International Relations" && nauruIr.paper === "GS-2", "correctTaxonomy compatibility/IR override failed.");

const moneyBillMap = filterRelevantMapLocations({
  title: "Money Bills in India",
  category: "Polity & Governance",
  text: "Article 110 and parliamentary procedure",
  mapLocations: ["India"],
});
assert(moneyBillMap.length === 0, "Money Bill incorrectly retained a map.");
const genericStatePolicyMap = filterRelevantMapLocations({
  title: "State government announces digital governance policy",
  category: "Polity & Governance",
  text: "The state government approved an administrative reform policy.",
  mapLocations: ["India"],
});
assert(genericStatePolicyMap.length === 0, "Generic state-policy story incorrectly triggered a map.");
const iranMap = filterRelevantMapLocations({
  title: "Indian ambassador appointed to Iran",
  category: "International Relations",
  text: "Bilateral diplomatic relations and ambassador to Iran",
  mapLocations: ["India", "Iran"],
});
assert(
  iranMap[0] === "Iran" && iranMap.includes("India"),
  `Iran map focus was not corrected: ${iranMap.join(", ")}`
);

assert(
  isSameEvent(
    { title: "Supreme Court Directs Measures to Curb Digital Arrest Scams", description: "SOPs and mechanisms", publishedAt: "2026-08-10" },
    { title: "Supreme Court Mandates SOPs, Mechanisms to Curb Digital Arrests", description: "Measures against scams", publishedAt: "2026-08-09" }
  ),
  "Same-cycle semantic duplicate was missed."
);
assert(
  !isSameEvent(
    { title: "Supreme Court Directs Measures to Curb Digital Arrest Scams", description: "First order", publishedAt: "2026-08-10" },
    { title: "Supreme Court Directs Measures to Curb Digital Arrest Scams", description: "Later new order", publishedAt: "2026-09-10" }
  ),
  "Later development was incorrectly deduplicated."
);

const skeleton = assessArticleQuality({
  why_news: "A short brief.", syllabus_linkage: "- GS-3", india_relevance: "India relevance.",
  static_foundation: "- One point", data_examples: "- One example", prelims: "- One fact",
  mains: "Short analysis.", answer_framework: "Short plan.",
});
assert(!skeleton.passed, "Thin skeleton incorrectly passed quality gate.");

console.log("CurrentPulse 11 Aug quality checks: PASS");
