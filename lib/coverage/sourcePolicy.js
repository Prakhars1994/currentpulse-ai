const SOURCE_POLICY = Object.freeze([
  {
    id: "vision",
    name: "Vision IAS",
    aliases: ["vision ias", "visionias"],
    domains: ["visionias.in"],
  },
  {
    id: "drishti",
    name: "Drishti IAS",
    aliases: ["drishti ias", "drishtiias"],
    domains: ["drishtiias.com"],
  },
  {
    id: "insights",
    name: "Insights IAS",
    aliases: ["insights ias", "insightsias", "insights on india"],
    domains: ["insightsonindia.com"],
  },
  {
    id: "forum",
    name: "ForumIAS",
    aliases: ["forumias", "forum ias"],
    domains: ["forumias.com"],
  },
  {
    id: "nextias",
    name: "NEXT IAS",
    aliases: ["next ias", "nextias"],
    domains: ["nextias.com"],
  },
  {
    id: "vajiram",
    name: "Vajiram & Ravi",
    aliases: ["vajiram & ravi", "vajiram and ravi", "vajiram"],
    domains: ["vajiramandravi.com"],
  },
  {
    id: "iasbaba",
    name: "IASbaba",
    aliases: ["iasbaba", "ias baba"],
    domains: ["iasbaba.com"],
  },
]);

export const APPROVED_UPSC_COVERAGE_SOURCE_IDS = Object.freeze(
  SOURCE_POLICY.map((source) => source.id)
);

export const APPROVED_UPSC_COVERAGE_SOURCES = Object.freeze(
  SOURCE_POLICY.map(({ id, name, domains }) =>
    Object.freeze({ id, name, domains: Object.freeze([...domains]) })
  )
);

function clean(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeName(value = "") {
  return clean(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sourceEntries(candidate = {}) {
  const nested = [
    ...(Array.isArray(candidate.article_sources) ? candidate.article_sources : []),
    ...(Array.isArray(candidate.sourceInputs) ? candidate.sourceInputs : []),
    ...(Array.isArray(candidate.coverage_sources) ? candidate.coverage_sources : []),
  ];

  const entries = nested.map((source) => ({
    name: clean(source?.source_name || source?.sourceName || source?.source),
    url: clean(source?.source_url || source?.sourceUrl || source?.url),
  }));

  for (const name of Array.isArray(candidate.sources) ? candidate.sources : []) {
    entries.push({ name: clean(name), url: "" });
  }

  const directName = clean(candidate.source || candidate.sourceName);
  const directUrl = clean(
    candidate.url ||
      candidate.link ||
      candidate.sourceUrl ||
      candidate.source_url
  );

  if (directName || directUrl) {
    entries.push({ name: directName, url: directUrl });
  }

  return entries.filter((entry) => entry.name || entry.url);
}

function hostname(value = "") {
  const raw = clean(value);
  if (!raw) return "";
  try {
    return new URL(raw).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function matchesPolicyEntry(entry, policy) {
  const normalized = normalizeName(entry.name);
  const host = hostname(entry.url);

  const aliasMatch = policy.aliases
    .map(normalizeName)
    .includes(normalized);

  const domainMatch =
    Boolean(host) &&
    policy.domains.some(
      (domain) => host === domain || host.endsWith("." + domain)
    );

  return aliasMatch || domainMatch;
}

export function hasApprovedUpscCoverageSource(candidate = {}) {
  return sourceEntries(candidate).some((entry) =>
    SOURCE_POLICY.some((policy) => matchesPolicyEntry(entry, policy))
  );
}
