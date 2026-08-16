function clean(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

const GEO_CATEGORIES = new Set([
  "Geography",
  "Environment",
  "International Relations",
  "History & Culture",
  "Defence & Security",
]);

const GEO_SIGNALS = /\b(?:river|lake|wetland|ramsar|national park|wildlife sanctuary|biosphere|tiger reserve|mountain|hill|range|pass|glacier|island|archipelago|strait|sea|ocean|gulf|bay|border|boundary|corridor|port|harbour|harbor|dam|reservoir|canal|earthquake|cyclone|volcano|landslide|conflict zone|archaeological site|heritage site|temple|cave|project site|coast|basin|plateau|desert|valley)\b/i;
const MAP_DENY = /\b(?:money bill|finance bill|constitutional amendment|article 14|article 19|article 21|supreme court judgment|high court judgment|judicial review|rbi policy|monetary policy|inflation|taxation|gst council|artificial intelligence regulation|data protection|committee report|index ranking|appointment|election procedure|parliamentary procedure|banking regulation|insolvency|stock exchange|sebi|repo rate)\b/i;
const FOREIGN_FOCUS_SIGNAL = /\b(?:international|bilateral|foreign|border|conflict|strait|sea|island|archipelago|country|neighbour|neighbor|gulf|ocean)\b/i;

export function normaliseMapLocations(value) {
  if (Array.isArray(value)) return value.map(clean).filter(Boolean).slice(0, 6);
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(clean).filter(Boolean).slice(0, 6) : [];
  } catch {
    return value.split(",").map(clean).filter(Boolean).slice(0, 6);
  }
}

export function isMapRelevantArticle({ title = "", category = "", text = "", mapLocations = [] } = {}) {
  const locations = normaliseMapLocations(mapLocations);
  const combined = clean(`${title} ${text}`);
  const nonGenericLocations = locations.filter((location) => !/^(?:india|world|global)$/i.test(location));

  if (MAP_DENY.test(combined) && !GEO_SIGNALS.test(combined)) return false;
  if (GEO_SIGNALS.test(combined)) return true;
  if (GEO_CATEGORIES.has(category) && nonGenericLocations.length > 0) return true;
  return false;
}

export function filterRelevantMapLocations({ title = "", category = "", text = "", mapLocations = [] } = {}) {
  const locations = normaliseMapLocations(mapLocations);
  if (!locations.length) return [];
  if (!isMapRelevantArticle({ title, category, text, mapLocations: locations })) return [];

  const combined = clean(`${title} ${text}`);
  const nonIndia = locations.filter((location) => !/^india$/i.test(location));
  if (nonIndia.length && FOREIGN_FOCUS_SIGNAL.test(combined)) {
    // Generic India must never become the primary locator for an explicitly
    // foreign/place-focused headline. Keep India only when the title itself
    // makes India part of the geographic subject (for example India–Oman).
    const titleMentionsIndia = /\bindia(?:n|'s|’s)?\b/i.test(clean(title));
    const includesIndia = locations.some((location) => /^india$/i.test(location));
    return [...nonIndia, ...(includesIndia && titleMentionsIndia ? ["India"] : [])].slice(0, 6);
  }
  return locations.slice(0, 6);
}
