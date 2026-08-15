
export const EXAM_VERTICALS = {
  upsc: {
    slug: "upsc",
    label: "UPSC",
    title: "UPSC Current Affairs",
    description: "Analytical Current Affairs with Prelims facts, static linkage and Mains dimensions.",
    mockMarks: 2,
    mockNegative: 0.66,
    subjects: ["Current Affairs", "Polity", "History", "Geography", "Economy", "Environment", "Science"],
  },
  ssc: {
    slug: "ssc",
    label: "SSC",
    title: "SSC Current Affairs",
    description: "High-yield factual Current Affairs for SSC CGL, CHSL, MTS and GD.",
    mockMarks: 1,
    mockNegative: 0.25,
    subjects: ["General Awareness", "Reasoning", "Quantitative Aptitude", "English"],
  },
  railway: {
    slug: "railway",
    label: "Railway",
    title: "Railway Current Affairs",
    description: "National, science, geography and factual updates for RRB NTPC, Group D, ALP and JE.",
    mockMarks: 1,
    mockNegative: 0.25,
    subjects: ["General Awareness", "Mathematics", "Reasoning", "General Science"],
  },
  banking: {
    slug: "banking",
    label: "Banking",
    title: "Banking Current Affairs",
    description: "RBI, economy, banking, financial-awareness and exam-relevant national updates.",
    mockMarks: 1,
    mockNegative: 0.25,
    subjects: ["Reasoning", "Quantitative Aptitude", "English", "Banking & Financial Awareness", "Current Affairs"],
  },
  "state-pcs": {
    slug: "state-pcs",
    label: "State PCS",
    title: "State PCS Current Affairs",
    description: "National Current Affairs plus state-oriented factual and analytical relevance.",
    mockMarks: 2,
    mockNegative: 0.66,
    subjects: ["Current Affairs", "Polity", "History", "Geography", "Economy", "Environment", "State GK"],
  },
};

export const EXAM_COACHING_SOURCES = [
  { id: "bankersadda", name: "BankersAdda", url: "https://www.bankersadda.com/current-affairs/", exams: ["banking", "ssc", "railway"], reuseMode: "facts-topics-attribution" },
  { id: "oliveboard", name: "Oliveboard", url: "https://www.oliveboard.in/daily-current-affairs/", exams: ["banking", "ssc", "railway", "state-pcs"], reuseMode: "facts-topics-attribution" },
  { id: "affairscloud", name: "AffairsCloud", url: "https://affairscloud.com/current-affairs/", exams: ["banking", "ssc", "railway", "state-pcs"], reuseMode: "facts-topics-attribution" },
  { id: "testbook", name: "Testbook", url: "https://testbook.com/current-affairs", exams: ["upsc", "banking", "ssc", "railway", "state-pcs"], reuseMode: "facts-topics-attribution" },
];

export const OPEN_QUESTION_SOURCES = [
  {
    id: "exambench",
    name: "ExamBench",
    url: "https://huggingface.co/datasets/169Pi/exambench",
    license: "Apache-2.0",
    reuseMode: "licensed-question-reuse",
  },
];

export function getExamVertical(slug = "upsc") {
  return EXAM_VERTICALS[slug] || EXAM_VERTICALS.upsc;
}

export function isKnownExamVertical(slug = "") {
  return Boolean(EXAM_VERTICALS[slug]);
}
