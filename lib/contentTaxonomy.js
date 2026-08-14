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
  "International Relations": ["bilateral", "multilateral", "diplomacy", "diplomatic", "foreign policy", "summit", "treaty", "pact", "agreement", "united nations", "g20", "brics", "imf", "world bank", "geopolitics", "geopolitical", "pacific island", "foreign minister"],
  "Science & Technology": ["science", "technology", "space", "isro", "satellite", "artificial intelligence", "quantum", "semiconductor", "biotech", "biotechnology", "genetics", "genetic", "genome", "genomic", "dna", "epigenetic", "nanotechnology", "robotics", "digital", "cyber technology"],
  Environment: ["environment", "climate", "ecology", "biodiversity", "pollution", "conservation", "forest", "wildlife", "emission", "renewable", "wetland"],
  "Defence & Security": ["defence", "defense", "military", "armed forces", "terror", "insurgency", "border security", "missile", "navy", "air force", "cybersecurity"],
  "Social Issues": ["society", "social", "health", "education", "women", "gender", "poverty", "nutrition", "caste", "tribal", "employment", "inequality"],
  Geography: ["geography", "river", "ocean", "mountain", "earthquake", "cyclone", "monsoon", "glacier", "volcano", "landslide"],
  "History & Culture": ["history", "culture", "heritage", "archaeology", "ancient", "medieval", "museum", "temple", "unesco", "civilisation", "civilization"],
  Sports: ["sport", "sports", "olympic", "paralympic", "athlete", "tournament", "championship", "world cup"],
};


const NEWS_CATEGORY_TERMS = {
  "Polity & Governance": [
    "constitution", "parliament", "government", "minister", "court", "judge",
    "election", "law", "bill", "act", "regulation", "governance",
  ],
  Economy: [
    "economy", "economic", "business", "market", "company", "bank", "finance",
    "inflation", "gdp", "trade", "export", "import", "tax", "revenue", "earnings",
  ],
  "International Relations": [
    "bilateral", "diplomatic", "diplomacy", "foreign policy", "summit", "treaty",
    "sanctions", "ambassador", "foreign minister", "strategic partnership",
  ],
  "Science & Technology": [
    "science", "technology", "spacex", "space", "rocket", "satellite", "nasa",
    "isro", "artificial intelligence", "ai", "quantum", "semiconductor",
    "cyber", "researchers", "study finds",
  ],
  Environment: [
    "environment", "climate", "wildlife", "biodiversity", "forest", "pollution",
    "conservation", "species", "emissions", "wetland",
  ],
  "Defence & Security": [
    "defence", "defense", "military", "army", "navy", "air force", "missile",
    "terror", "attack", "war", "armed conflict", "security forces",
  ],
  "Social Issues": [
    "health", "disease", "outbreak", "salmonella", "recall", "hospital",
    "education", "school", "university", "crime", "police", "murder", "poverty",
    "employment", "women", "gender", "nutrition",
  ],
  Geography: [
    "earthquake", "cyclone", "volcano", "landslide", "glacier", "river",
    "ocean", "monsoon", "tsunami",
  ],
  "History & Culture": [
    "history", "heritage", "archaeology", "museum", "temple", "culture", "unesco",
  ],
  Sports: [
    "sport", "sports", "olympic", "paralympic", "athlete", "tournament",
    "championship", "world cup", "match",
  ],
};

const PAPER_BY_CATEGORY = {
  "History & Culture": "GS-1",
  Geography: "GS-1",
  "Social Issues": "GS-2",
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


export function classifyNewsCategory(text, suggestedCategory = "") {
  const value = cleanText(text).toLowerCase();

  if (
    /\b(?:chess|chess olympiad|olympiad|cricket|football|tennis|badminton|hockey|athlete|tournament|championship|world cup|grand slam|match)\b/i.test(value)
  ) {
    return "Sports";
  }

  const scoringValue = value
    .replace(/\btitle\s+defen[cs]e\b/gi, "title retention")
    .replace(/\bdefending\s+champion\b/gi, "reigning champion");

  const override = taxonomyOverride(scoringValue);
  if (override) return override.category;

  const scores = new Map(
    Object.keys(NEWS_CATEGORY_TERMS).map((category) => [category, 0])
  );

  for (const [category, terms] of Object.entries(NEWS_CATEGORY_TERMS)) {
    for (const term of terms) {
      if (containsTerm(scoringValue, term)) {
        scores.set(category, scores.get(category) + (term.includes(" ") ? 2 : 1));
      }
    }
  }

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  if (ranked[0]?.[1] > 0) return ranked[0][0];

  // Do not inherit a weak/default Polity label when ordinary News has no
  // matching UPSC-style taxonomy signal.
  const suggested = normalizeCategory(suggestedCategory, "");
  if (suggested && suggested !== "Polity & Governance") return suggested;
  return "General News";
}

const TAXONOMY_OVERRIDES = [
  {
    pattern: /\b(?:vultures?|clouded leopard|wildlife sanctuary|national park|tiger reserve|biosphere reserve|endangered species|critically endangered|species conservation|wildlife conservation)\b/i,
    category: "Environment",
    paper: "GS-3",
  },
  {
    pattern: /\b(?:hydropower|hydro power|hydroelectric|hydro-electric|power project|dam project|pumped storage project)\b/i,
    category: "Economy",
    paper: "GS-3",
  },
  {
    pattern: /\b(?:e-samudra|digital maritime governance|maritime governance portal|seafarer welfare portal)\b/i,
    category: "Polity & Governance",
    paper: "GS-2",
  },
  {
    pattern: /\b(?:bilateral|strategic partnership|state visit|official visit|ambassador|high commissioner|foreign minister|external affairs minister|diplomatic relations?)\b/i,
    category: "International Relations",
    paper: "GS-2",
  },
  {
    pattern: /\b(?:epigenetic|epigenome|dna methylation|histone modification|gene expression|genetic inheritance|genetics?|genomics?|genome sequencing|gene editing)\b/i,
    category: "Science & Technology",
    paper: "GS-3",
  },
  {
    // A country-profile/location story about Nauru is a Geography/Prelims item.
    // Explicit diplomatic/bilateral signals are matched by the earlier IR rule.
    pattern: /\b(?:nauru|naoero)\b/i,
    category: "Geography",
    paper: "GS-1",
  },
  {
    pattern: /\b(?:pacific island countr(?:y|ies)|small island developing states?)\b[\s\S]{0,300}\b(?:diplomatic|geopolitic|foreign policy|rename|agreement|treaty|recognition)\b|\b(?:diplomatic|geopolitic|foreign policy|rename|agreement|treaty|recognition)\b[\s\S]{0,300}\b(?:pacific island countr(?:y|ies)|small island developing states?)\b/i,
    category: "International Relations",
    paper: "GS-2",
  },
];

export function taxonomyOverride(text = "") {
  return TAXONOMY_OVERRIDES.find((rule) => rule.pattern.test(cleanText(text))) || null;
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
  const override = taxonomyOverride(value);
  if (override) return override.category;
  const suggested = normalizeCategory(suggestedCategory, "");
  const scores = new Map(VALID_CATEGORIES.map((category) => [category, 0]));

  // AI/source hints are weak evidence. They must never overpower the actual
  // subject matter, which was the cause of Biology→Social Issues and IR→Economy.
  if (suggested) scores.set(suggested, 0.75);

  for (const [category, terms] of Object.entries(CATEGORY_TERMS)) {
    for (const term of terms) {
      if (containsTerm(value, term)) {
        scores.set(category, scores.get(category) + (term.includes(" ") ? 2 : 1));
      }
    }
  }

  if (!CATEGORY_TERMS.Sports.some((term) => containsTerm(value, term))) {
    scores.set("Sports", 0);
  }

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  return ranked[0][1] > 0 ? ranked[0][0] : suggested || "Polity & Governance";
}

export function classifyCategoryWithConfidence(text, suggestedCategory = "") {
  const value = cleanText(text).toLowerCase();
  const override = taxonomyOverride(value);
  if (override) {
    return {
      category: override.category,
      score: 99,
      secondScore: 0,
      gap: 99,
      confident: true,
      overridden: true,
    };
  }

  const suggested = normalizeCategory(suggestedCategory, "");
  const scores = new Map(VALID_CATEGORIES.map((category) => [category, 0]));
  if (suggested) scores.set(suggested, 0.75);

  for (const [category, terms] of Object.entries(CATEGORY_TERMS)) {
    for (const term of terms) {
      if (containsTerm(value, term)) {
        scores.set(category, scores.get(category) + (term.includes(" ") ? 2 : 1));
      }
    }
  }

  if (!CATEGORY_TERMS.Sports.some((term) => containsTerm(value, term))) {
    scores.set("Sports", 0);
  }

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const [category, score] = ranked[0];
  const secondScore = ranked[1]?.[1] || 0;
  const gap = score - secondScore;

  return {
    category: score > 0 ? category : suggested || "Polity & Governance",
    score,
    secondScore,
    gap,
    confident: score >= 2 && gap >= 0.75,
    overridden: false,
  };
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
  const canonicalPaper = PAPER_BY_CATEGORY[category];
  if (canonicalPaper) return canonicalPaper;
  return normalizedSuggested || "Prelims";
}

export function correctTaxonomy(text, suggestedCategory = "", suggestedPaper = "") {
  const override = taxonomyOverride(text);
  if (override) {
    return { category: override.category, paper: override.paper, overridden: true };
  }

  const category = classifyCategory(text, suggestedCategory);
  const paper = resolvePaper(category, suggestedPaper);
  const normalizedSuggestedCategory = normalizeCategory(suggestedCategory, "");
  const normalizedSuggestedPaper = normalizePaper(suggestedPaper, "");
  return {
    category,
    paper,
    overridden:
      Boolean(normalizedSuggestedCategory || normalizedSuggestedPaper) &&
      (category !== normalizedSuggestedCategory || paper !== normalizedSuggestedPaper),
  };
}
