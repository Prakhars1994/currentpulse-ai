export const EXAM_VERTICALS = {
  upsc: {
    slug: "upsc", label: "UPSC", title: "UPSC Current Affairs",
    hiTitle: "UPSC करेंट अफेयर्स",
    description: "Analytical Current Affairs with Prelims facts, static linkage and Mains dimensions.",
    hiDescription: "प्रीलिम्स तथ्यों, स्थैतिक लिंक और मेन्स विश्लेषण के साथ उच्च-गुणवत्ता करेंट अफेयर्स।",
    mockMarks: 2, mockNegative: 0.66,
    subjects: ["Current Affairs","Polity","History","Geography","Economy","Environment","Science"],
  },
  ssc: {
    slug: "ssc", label: "SSC", title: "SSC Current Affairs",
    hiTitle: "SSC करेंट अफेयर्स",
    description: "High-yield factual Current Affairs for SSC CGL, CHSL, MTS and GD.",
    hiDescription: "SSC CGL, CHSL, MTS और GD के लिए उच्च-उपयोगिता तथ्यात्मक करेंट अफेयर्स।",
    mockMarks: 1, mockNegative: 0.25,
    subjects: ["General Awareness","Reasoning","Quantitative Aptitude","English"],
  },
  railway: {
    slug: "railway", label: "Railway", title: "Railway Current Affairs",
    hiTitle: "रेलवे करेंट अफेयर्स",
    description: "National, science, geography and factual updates for RRB NTPC, Group D, ALP and JE.",
    hiDescription: "RRB NTPC, Group D, ALP और JE के लिए राष्ट्रीय, विज्ञान, भूगोल और तथ्यात्मक अपडेट।",
    mockMarks: 1, mockNegative: 0.25,
    subjects: ["General Awareness","Mathematics","Reasoning","General Science"],
  },
  banking: {
    slug: "banking", label: "Banking", title: "Banking Current Affairs",
    hiTitle: "बैंकिंग करेंट अफेयर्स",
    description: "RBI, economy, banking, financial-awareness and exam-relevant national updates.",
    hiDescription: "RBI, अर्थव्यवस्था, बैंकिंग, वित्तीय जागरूकता और परीक्षा-उपयोगी राष्ट्रीय अपडेट।",
    mockMarks: 1, mockNegative: 0.25,
    subjects: ["Reasoning","Quantitative Aptitude","English","Banking & Financial Awareness","Current Affairs"],
  },
  "state-pcs": {
    slug: "state-pcs", label: "State PCS", title: "State PCS Current Affairs",
    hiTitle: "राज्य PCS करेंट अफेयर्स",
    description: "National Current Affairs plus state-oriented factual and analytical relevance.",
    hiDescription: "राष्ट्रीय करेंट अफेयर्स के साथ राज्य-केंद्रित तथ्य और विश्लेषण।",
    mockMarks: 2, mockNegative: 0.66,
    subjects: ["Current Affairs","Polity","History","Geography","Economy","Environment","State GK"],
  },
};

export const EXAM_COACHING_SOURCES = [
  { id:"bankersadda", name:"BankersAdda", url:"https://www.bankersadda.com/current-affairs/", exams:["banking","ssc","railway"], reuseMode:"facts-topics-attribution" },
  { id:"oliveboard", name:"Oliveboard", url:"https://www.oliveboard.in/daily-current-affairs/", exams:["banking","ssc","railway","state-pcs"], reuseMode:"facts-topics-attribution" },
  { id:"affairscloud", name:"AffairsCloud", url:"https://affairscloud.com/current-affairs/", exams:["banking","ssc","railway","state-pcs"], reuseMode:"facts-topics-attribution" },
  { id:"testbook", name:"Testbook", url:"https://testbook.com/current-affairs", exams:["upsc","banking","ssc","railway","state-pcs"], reuseMode:"facts-topics-attribution" },
];

export const OPEN_QUESTION_SOURCES = [
  { id:"exambench", name:"ExamBench", url:"https://huggingface.co/datasets/169Pi/exambench", license:"Apache-2.0", reuseMode:"licensed-question-reuse" },
];

export const SUPPORTED_LANGUAGES = Object.freeze([
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
]);

export function getExamVertical(slug = "upsc") {
  return EXAM_VERTICALS[slug] || EXAM_VERTICALS.upsc;
}
export function isKnownExamVertical(slug = "") {
  return Boolean(EXAM_VERTICALS[slug]);
}
