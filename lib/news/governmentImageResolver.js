import { deadlineSignal, remainingDeadlineMs } from "@/lib/network/deadline";

export const TERMINAL_IMAGE_RESOLUTION_STATUSES = new Set([
  "resolved",
  "no_safe_image",
  "preserved_existing",
  "rejected",
]);

const PROVIDERS = {
  isro: { label: "ISRO", usage: "government_public_domain_review_required", search: (q) => `https://www.isro.gov.in/search.html?search=${encodeURIComponent(q)}`, imageHosts: ["isro.gov.in"] },
  nasa: { label: "NASA", usage: "nasa_media_usage", search: (q) => `https://images-api.nasa.gov/search?q=${encodeURIComponent(q)}&media_type=image&page_size=10`, imageHosts: ["images-assets.nasa.gov", "nasa.gov"] },
  noaa: { label: "NOAA", usage: "noaa_public_domain_review_required", search: (q) => `https://www.noaa.gov/search?search_api_fulltext=${encodeURIComponent(q)}`, imageHosts: ["noaa.gov"] },
  usgs: { label: "USGS", usage: "usgs_public_domain_review_required", search: (q) => `https://www.usgs.gov/search?keywords=${encodeURIComponent(q)}`, imageHosts: ["usgs.gov"] },
  pib: { label: "PIB", usage: "pib_government_media_review_required", search: (q) => `https://pib.gov.in/PressReleaseIframePage.aspx?PRID=&reg=3&lang=2&search=${encodeURIComponent(q)}`, imageHosts: ["pib.gov.in"] },
  usda_ars: { label: "USDA ARS", usage: "usda_public_domain_review_required", search: (q) => `https://www.ars.usda.gov/search/?q=${encodeURIComponent(q)}`, imageHosts: ["usda.gov"] },
  nps: { label: "National Park Service", usage: "nps_public_domain_review_required", search: (q) => `https://www.nps.gov/findapark/index.htm?query=${encodeURIComponent(q)}`, imageHosts: ["nps.gov"] },
  cdc_nih: { label: "CDC/NIH", usage: "federal_public_domain_review_required", search: (q) => `https://search.cdc.gov/search/?query=${encodeURIComponent(q)}`, imageHosts: ["cdc.gov", "nih.gov"] },
};

function clean(value = "") { return String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(); }
function hostname(value = "") { try { return new URL(value).hostname.toLowerCase(); } catch { return ""; } }
function isProviderHost(url, provider) { const host = hostname(url); return PROVIDERS[provider].imageHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`)); }
function queryFor(article = {}) { return clean([article.title, article.category].filter(Boolean).join(" ")).slice(0, 180); }

export function isTerminalImageResolution(value) {
  return Boolean(value && TERMINAL_IMAGE_RESOLUTION_STATUSES.has(value.status));
}

export function governmentImageProviderPriority(category = "") {
  const value = String(category).toLowerCase();
  if (/space|science/.test(value)) return ["isro", "nasa"];
  if (/environment|disaster|geography/.test(value)) return ["noaa", "usgs", "nasa"];
  if (/agri|rural|food/.test(value)) return ["pib", "usda_ars"];
  if (/health|social/.test(value)) return ["pib", "cdc_nih"];
  if (/wildlife|nature|forest/.test(value)) return ["nps", "usgs"];
  return ["pib"];
}

function terminal(status, provider, requestsUsed, extra = {}) {
  return {
    status, provider: provider || "currentpulse_fallback", attempted_at: new Date().toISOString(),
    requests_used: requestsUsed, attribution: extra.attribution || "", license_or_usage: extra.license_or_usage || "", source_page_url: extra.source_page_url || "",
  };
}

function nasaCandidate(payload, provider) {
  const item = payload?.collection?.items?.find((entry) => {
    const link = (entry.links || []).find((candidate) => candidate?.rel === "preview");
    return link?.href && isProviderHost(link.href, provider);
  });
  if (!item) return null;
  const imageUrl = item.links.find((entry) => entry.rel === "preview").href;
  const data = item.data?.[0] || {};
  const title = clean(data.title);
  const description = clean(data.description);
  const page = item.href || "";
  return { url: imageUrl, sourcePageUrl: page, attribution: ["NASA", title].filter(Boolean).join(" · ").slice(0, 500), licenseOrUsage: PROVIDERS.nasa.usage, alt: title || description };
}

async function searchProvider(provider, query, options) {
  const config = PROVIDERS[provider];
  const signal = deadlineSignal(options.deadlineAt, 8000);
  if (!signal) return null;
  const response = await (options.fetch || fetch)(config.search(query), { headers: { Accept: provider === "nasa" ? "application/json" : "text/html", "User-Agent": "CurrentPulse/1.0 government-media resolver" }, cache: "no-store", signal });
  if (!response.ok) return null;
  if (provider !== "nasa") return null;
  return nasaCandidate(await response.json(), provider);
}

// This is deliberately a publication/backfill helper. It never runs in page rendering.
export async function resolveGovernmentArticleImage(article = {}, options = {}) {
  const existing = article.image_resolution;
  if (isTerminalImageResolution(existing)) return { image: null, resolution: existing, searched: false };
  if (options.preserveExisting) return { image: null, resolution: terminal("preserved_existing", "existing", 0, { attribution: article.image_caption, source_page_url: article.image_source_url }), searched: false };
  const providers = governmentImageProviderPriority(article.category).slice(0, 2);
  let requestsUsed = 0;
  let lastProvider = providers.at(-1) || "currentpulse_fallback";
  for (const provider of providers) {
    if (!remainingDeadlineMs(options.deadlineAt, 1000)) break;
    requestsUsed += 1; lastProvider = provider;
    try {
      const candidate = await searchProvider(provider, queryFor(article), options);
      if (!candidate || !isProviderHost(candidate.url, provider) || !isProviderHost(candidate.sourcePageUrl, provider)) continue;
      return { image: candidate, searched: true, resolution: terminal("resolved", provider, requestsUsed, { attribution: candidate.attribution, license_or_usage: candidate.licenseOrUsage, source_page_url: candidate.sourcePageUrl }) };
    } catch (error) { console.error(`[Government image] ${provider} request failed:`, error?.message || error); }
  }
  return { image: null, searched: requestsUsed > 0, resolution: terminal("no_safe_image", lastProvider, requestsUsed, { license_or_usage: "currentpulse_category_fallback" }) };
}
