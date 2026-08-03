export const VALID_CATEGORIES = [
  "Polity & Governance",
  "Economy",
  "International Relations",
  "Science & Technology",
  "Environment",
  "Defence & Security",
  "Social Issues",
  "Geography",
  "History & Culture",
  "Government Schemes",
  "Sports",
];

export const VALID_PAPERS = ["Prelims", "GS-1", "GS-2", "GS-3", "GS-4", "Essay"];

const CATEGORY_TERMS = {
  "Government Schemes": ["scheme", "mission", "programme", "program", "yojana", "initiative", "subsidy", "beneficiary"],
  "Polity & Governance": ["constitution", "parliament", "judiciary", "supreme court", "high court", "governance", "election", "federal", "fundamental right", "bill", "act", "tribunal"],
  Economy: ["economy", "economic", "rbi", "inflation", "gdp", "bank", "banking", "finance", "fiscal", "monetary", "tax", "trade", "export", "import", "agriculture"],
  "International Relations": ["bilateral", "multilateral", "diplomacy", "foreign policy", "summit", "treaty", "united nations", "g20", "brics", "imf", "world bank", "geopolitics", "geopolitical"],
  "Science & Technology": ["science", "technology", "space", "isro", "satellite", "artificial intelligence", "quantum", "semiconductor", "biotech", "digital", "cyber technology"],
  Environment: ["environment", "climate", "ecology", "biodiversity", "pollution", "conservation", "forest", "wildlife", "emission", "renewable", "wetland"],
  "Defence & Security": ["defence", "defense", "military", "armed forces", "terror", "insurgency", "border security", "missile", "navy", "air force", "cybersecurity"],
  "Social Issues": ["society", "social", "health", "education", "women", "gender", "poverty", "nutrition", "caste", "tribal", "employment", "inequality"],
  Geography: ["geography", "river", "ocean", "mountain", "earthquake", "cyclone", "monsoon", "glacier", "volcano", "landslide"],
  "History & Culture": ["history", "culture", "heritage", "archaeology", "ancient", "medieval", "museum", "temple", "unesco", "civilisation", "civilization"],
  Sports: ["sport", "sports", "olympic", "paralympic", "athlete", "tournament", "championship", "world cup"],
};

const PAPER_BY_CATEGORY = {
  "History & Culture": "GS-1",
  Geography: "GS-1",
  "Social Issues": "GS-1",
  "Polity & Governance": "GS-2",
  "International Relations": "GS-2",
  "Government Schemes": "GS-2",
  Economy: "GS-3",
  "Science & Technology": "GS-3",
  Environment: "GS-3",
  "Defence & Security": "GS-3",
  Sports: "Prelims",
};

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function containsTerm(text, term) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped.replace(/\s+/g, "\\s+")}\\b`, "i").test(text);
}

export function normalizeCategory(category, fallback = "Polity & Governance") {
  const value = cleanText(category).toLowerCase();
  const exact = VALID_CATEGORIES.find((item) => item.toLowerCase() === value);
  if (exact) return exact;

  const aliases = [
    ["Polity & Governance", /polity|governance|constitution|judiciary/],
    ["Economy", /econom|finance|banking|agriculture/],
    ["International Relations", /international|foreign|diplomacy/],
    ["Science & Technology", /science|technology|space/],
    ["Environment", /environment|climate|ecology/],
    ["Defence & Security", /defen[cs]e|security|military/],
    ["Social Issues", /social|society|health|education/],
    ["Geography", /geograph/],
    ["History & Culture", /history|culture|heritage|archaeology/],
    ["Government Schemes", /scheme|programme|program|yojana|mission/],
    ["Sports", /sport|olympic|athlete|tournament|championship/],
  ];

  return aliases.find(([, pattern]) => pattern.test(value))?.[0] || fallback;
}

export function classifyCategory(text, suggestedCategory = "") {
  const value = cleanText(text).toLowerCase();
  const suggested = normalizeCategory(suggestedCategory, "");
  const scores = new Map(VALID_CATEGORIES.map((category) => [category, 0]));

  if (suggested) scores.set(suggested, 2.5);

  for (const [category, terms] of Object.entries(CATEGORY_TERMS)) {
    for (const term of terms) {
      if (containsTerm(value, term)) {
        scores.set(category, scores.get(category) + (term.includes(" ") ? 2 : 1));
      }
    }
  }

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  return ranked[0][1] > 0 ? ranked[0][0] : suggested || "Polity & Governance";
}

export function normalizePaper(paper, fallback = "Prelims") {
  const value = cleanText(paper)
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace("GENERALSTUDIES", "GS");

  const paperMap = {
    PRELIMS: "Prelims", GS1: "GS-1", "GS-1": "GS-1", GS2: "GS-2",
    "GS-2": "GS-2", GS3: "GS-3", "GS-3": "GS-3", GS4: "GS-4",
    "GS-4": "GS-4", ESSAY: "Essay",
  };

  return paperMap[value] || fallback;
}

export function resolvePaper(category, suggestedPaper = "") {
  const normalizedSuggested = normalizePaper(suggestedPaper, "");
  return normalizedSuggested || PAPER_BY_CATEGORY[category] || "Prelims";
}
