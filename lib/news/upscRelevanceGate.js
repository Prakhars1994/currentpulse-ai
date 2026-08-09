const INDIA_SIGNALS = [
  "india", "indian", "new delhi", "union government", "parliament", "lok sabha",
  "rajya sabha", "supreme court", "high court", "rbi", "sebi", "niti aayog",
  "isro", "drdo", "ministry of", "government of india", "constitution of india",
  "indian ocean", "indo-pacific", "south asia", "rupee", "aadhaar", "upi",
];

const NEIGHBOUR_SIGNALS = [
  "pakistan", "china", "bangladesh", "sri lanka", "nepal", "bhutan", "myanmar",
  "maldives", "afghanistan", "line of actual control", "line of control",
  "bay of bengal", "arabian sea", "himalayan", "bimstec", "saarc",
];

const STRATEGIC_SIGNALS = [
  "border", "security", "defence", "military", "maritime", "diplomacy", "treaty",
  "trade", "connectivity", "river", "water sharing", "migration", "refugee",
  "terror", "insurgency", "disaster", "climate", "energy", "supply chain",
];

const GLOBAL_SYSTEMIC_SIGNALS = [
  "g20", "brics", "quad", "sco", "un security council", "unsc", "wto reform",
  "who pandemic", "pandemic agreement", "global financial", "global recession",
  "global trade", "global supply chain", "oil shock", "food security", "energy security",
  "climate change", "cop", "unfccc", "biodiversity convention", "global treaty",
  "nuclear", "war", "armed conflict", "red sea", "strait of hormuz", "artificial intelligence governance",
  "global minimum tax", "international court of justice", "international criminal court",
];

const ROUTINE_FOREIGN_COUNTRY_SIGNALS = [
  "article iv consultation", "staff concludes visit", "mission concludes visit",
  "country partnership framework", "country economic memorandum", "approves loan",
  "development policy loan", "extended fund facility", "rapid credit facility",
  "stand-by arrangement", "credit facility review", "country assessment",
  "upper-middle-income country", "upper middle income country", "country classification",
  "municipal election", "local election", "provincial election",
];

const ROUTINE_NOISE_SIGNALS = [
  "invites tender", "invites tenders", "issues tender", "procurement tender",
  "request for proposal", "expression of interest", "e-tender", "bid invitation",
  "studs for", "substrate patterning", "dicing services", "supply of", "purchase of",
  "quarterly sales", "monthly sales", "sales surge", "stock rises", "stock falls",
  "share price", "earnings call", "board meeting", "dividend announcement",
  "appointment of director", "appointed as director", "local accident", "road accident",
];

const HIGH_VALUE_OVERRIDES = [
  "cabinet approves", "parliament passes", "supreme court", "constitutional bench",
  "rbi monetary policy", "union budget", "economic survey", "census", "national policy",
  "new act", "new bill", "rules notified", "government launches", "isro mission",
  "satellite launch", "missile test", "nuclear doctrine", "climate report",
];

function clean(value = "") {
  return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function matching(text, signals) {
  return signals.filter((signal) => text.includes(signal));
}

/**
 * Deterministic pre-screen. It rejects obvious low-value noise before an AI
 * call, while borderline policy/science items still reach the editorial model.
 */
export function assessUpscRelevance(article = {}) {
  const text = clean(`${article.title || ""} ${article.description || article.summary || ""}`);
  const region = clean(article.region);
  const sourceGroup = clean(article.sourceGroup);
  const india = matching(text, INDIA_SIGNALS);
  const neighbours = matching(text, NEIGHBOUR_SIGNALS);
  const strategic = matching(text, STRATEGIC_SIGNALS);
  const systemic = matching(text, GLOBAL_SYSTEMIC_SIGNALS);
  const routineForeign = matching(text, ROUTINE_FOREIGN_COUNTRY_SIGNALS);
  const routineNoise = matching(text, ROUTINE_NOISE_SIGNALS);
  const highValue = matching(text, HIGH_VALUE_OVERRIDES);
  const domesticSource = region === "in" || sourceGroup === "indian-news" || sourceGroup === "official";

  if (routineNoise.length && !highValue.length) {
    return {
      eligible: false,
      hardReject: true,
      scope: "Routine / Low-value",
      scoreAdjustment: -10,
      reason: `Routine operational, procurement or market-noise item: ${routineNoise[0]}.`,
    };
  }

  if (india.length || domesticSource) {
    return {
      eligible: true,
      hardReject: false,
      scope: "India",
      scoreAdjustment: highValue.length ? 4 : india.length ? 3 : 1,
      reason: india.length
        ? `India relevance: ${india.slice(0, 3).join(", ")}.`
        : "Indian source requiring editorial evaluation.",
    };
  }

  if (neighbours.length && strategic.length) {
    return {
      eligible: true,
      hardReject: false,
      scope: "India's Neighbourhood",
      scoreAdjustment: 2,
      reason: `Neighbourhood and strategic relevance: ${[...neighbours, ...strategic].slice(0, 4).join(", ")}.`,
    };
  }

  if (systemic.length) {
    return {
      eligible: true,
      hardReject: false,
      scope: "Global Systemic",
      scoreAdjustment: Math.min(3, systemic.length + 1),
      reason: `Global systemic relevance: ${systemic.slice(0, 3).join(", ")}.`,
    };
  }

  if (routineForeign.length) {
    return {
      eligible: false,
      hardReject: true,
      scope: "Routine Foreign",
      scoreAdjustment: -8,
      reason: `Routine country-specific foreign update without a demonstrated India or global-systemic link: ${routineForeign[0]}.`,
    };
  }

  return {
    eligible: false,
    hardReject: false,
    scope: "Needs Editorial Review",
    scoreAdjustment: region === "world" ? -2 : 0,
    reason: "No direct India, neighbourhood-strategic or global-systemic signal was detected.",
  };
}
