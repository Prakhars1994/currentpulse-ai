const CATEGORY_WEIGHT = {
  "Polity & Governance": 9,
  "International Relations": 9,
  "Defence & Security": 9,
  Economy: 8,
  Environment: 7,
  "Science & Technology": 7,
  "Social Issues": 6,
  Geography: 5,
  "History & Culture": 4,
  Sports: 1,
};

const HIGH_IMPACT = [
  /\b(?:supreme court|constitution bench|parliament|cabinet|election commission)\b/i,
  /\b(?:rbi|monetary policy|union budget|economic survey|gdp|inflation)\b/i,
  /\b(?:war|ceasefire|sanctions|missile|military|terror|earthquake|cyclone|flood|outbreak)\b/i,
  /\b(?:prime minister|president|foreign minister|summit|treaty|agreement)\b/i,
  /\b(?:isro|nasa|space mission|semiconductor|artificial intelligence|climate)\b/i,
];

const LOW_IMPACT = [
  /\b(?:share price|stock recommendation|buy call|sell call|ipo allotment|price target)\b/i,
  /\b(?:celebrity|actor|actress|viral video|instagram|transfer rumour|transfer rumor)\b/i,
];

function timeValue(article = {}) {
  const value = article.created_at || article.updated_at;
  const timestamp = value ? new Date(value).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function newsPriorityScore(article = {}, reference = Date.now()) {
  const combined = `${article.title || ""} ${article.why_news || ""}`;
  const categoryScore = CATEGORY_WEIGHT[article.category] || 4;
  const impactScore = HIGH_IMPACT.reduce((score, pattern) => score + (pattern.test(combined) ? 5 : 0), 0);
  const penalty = LOW_IMPACT.reduce((score, pattern) => score + (pattern.test(combined) ? 8 : 0), 0);
  const ageHours = Math.max(0, (reference - timeValue(article)) / 3600000);
  const freshness = Math.max(0, 12 - ageHours / 3);
  return categoryScore + impactScore + freshness - penalty;
}

export function rankNewsByPriority(items = []) {
  const reference = Date.now();
  return [...items].sort((left, right) =>
    newsPriorityScore(right, reference) - newsPriorityScore(left, reference) ||
    timeValue(right) - timeValue(left)
  );
}
