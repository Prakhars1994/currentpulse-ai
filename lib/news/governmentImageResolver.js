import { deadlineSignal, remainingDeadlineMs } from "@/lib/network/deadline";

export const TERMINAL_IMAGE_RESOLUTION_STATUSES = new Set([
  "resolved",
  "no_safe_image",
  "preserved_existing",
  "rejected",
]);

const PROVIDERS = {
  wikimedia: {
    label: "Wikimedia Commons",
    usage: "wikimedia_commons_file_license",
    imageHosts: ["upload.wikimedia.org", "commons.wikimedia.org"],
  },
  isro: { label: "ISRO", usage: "government_public_domain_review_required", search: (q) => `https://www.isro.gov.in/search.html?search=${encodeURIComponent(q)}`, imageHosts: ["isro.gov.in"] },
  nasa: { label: "NASA", usage: "nasa_media_usage", search: (q) => `https://images-api.nasa.gov/search?q=${encodeURIComponent(q)}&media_type=image&page_size=10`, imageHosts: ["images-assets.nasa.gov", "nasa.gov"] },
  noaa: { label: "NOAA", usage: "noaa_public_domain_review_required", search: (q) => `https://www.noaa.gov/search?search_api_fulltext=${encodeURIComponent(q)}`, imageHosts: ["noaa.gov"] },
  usgs: { label: "USGS", usage: "usgs_public_domain_review_required", search: (q) => `https://www.usgs.gov/search?keywords=${encodeURIComponent(q)}`, imageHosts: ["usgs.gov"] },
  pib: { label: "PIB", usage: "pib_government_media_review_required", search: (q) => `https://pib.gov.in/PressReleaseIframePage.aspx?PRID=&reg=3&lang=2&search=${encodeURIComponent(q)}`, imageHosts: ["pib.gov.in"] },
  usda_ars: { label: "USDA ARS", usage: "usda_public_domain_review_required", search: (q) => `https://www.ars.usda.gov/search/?q=${encodeURIComponent(q)}`, imageHosts: ["usda.gov"] },
  nps: { label: "National Park Service", usage: "nps_public_domain_review_required", search: (q) => `https://www.nps.gov/findapark/index.htm?query=${encodeURIComponent(q)}`, imageHosts: ["nps.gov"] },
  cdc_nih: { label: "CDC/NIH", usage: "federal_public_domain_review_required", search: (q) => `https://search.cdc.gov/search/?query=${encodeURIComponent(q)}`, imageHosts: ["cdc.gov", "nih.gov"] },
};

function clean(value = "") { return String(value || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim(); }
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
  return { url: imageUrl, sourcePageUrl: page, attribution: ["NASA", title].filter(Boolean).join(" · ").slice(0, 500), licenseOrUsage: PROVIDERS.nasa.usage, alt: title || description, storagePolicy: "cache" };
}

function wikimediaCandidate(payload) {
  const pages = Object.values(payload?.query?.pages || {});
  for (const page of pages) {
    const info = page?.imageinfo?.[0];
    const meta = info?.extmetadata || {};
    const url = info?.thumburl || info?.url || "";
    const sourcePageUrl = info?.descriptionurl || page?.canonicalurl || "";
    if (!url || !sourcePageUrl || !isProviderHost(url, "wikimedia") || !isProviderHost(sourcePageUrl, "wikimedia")) continue;
    const license = clean(meta.LicenseShortName?.value || meta.UsageTerms?.value || "");
    const artist = clean(meta.Artist?.value || meta.Credit?.value || "");
    const title = clean(meta.ObjectName?.value || page?.title?.replace(/^File:/i, "") || "");
    const description = clean(meta.ImageDescription?.value || "");
    if (!license) continue;
    return {
      url,
      sourcePageUrl,
      attribution: [title, artist, license, "Wikimedia Commons"].filter(Boolean).join(" · ").slice(0, 700),
      licenseOrUsage: license,
      alt: description || title,
      storagePolicy: "hotlink",
    };
  }
  return null;
}

async function searchWikimedia(query, options) {
  const signal = deadlineSignal(options.deadlineAt, 7000);
  if (!signal) return null;
  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: query,
    gsrnamespace: "6",
    gsrlimit: "5",
    prop: "imageinfo|info",
    iiprop: "url|extmetadata",
    iiurlwidth: "1200",
    inprop: "url",
    format: "json",
    origin: "*",
  });
  const response = await (options.fetch || fetch)(`https://commons.wikimedia.org/w/api.php?${params.toString()}`, {
    headers: { Accept: "application/json", "User-Agent": "CurrentPulse/1.0 Wikimedia image resolver" },
    cache: "force-cache",
    next: { revalidate: 604800 },
    signal,
  });
  if (!response.ok) return null;
  return wikimediaCandidate(await response.json());
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

// Publication/backfill helper only. It never runs during public page rendering.
// Order: cached existing -> Wikimedia Commons -> topic-specific official providers -> terminal no-image.
export async function resolveGovernmentArticleImage(article = {}, options = {}) {
  const existing = article.image_resolution;
  if (isTerminalImageResolution(existing)) return { image: null, resolution: existing, searched: false };
  if (options.preserveExisting) return { image: null, resolution: terminal("preserved_existing", "existing", 0, { attribution: article.image_caption, source_page_url: article.image_source_url }), searched: false };

  const query = queryFor(article);
  let requestsUsed = 0;

  if (remainingDeadlineMs(options.deadlineAt, 1000)) {
    requestsUsed += 1;
    try {
      const candidate = await searchWikimedia(query, options);
      if (candidate) {
        return { image: candidate, searched: true, resolution: terminal("resolved", "wikimedia", requestsUsed, { attribution: candidate.attribution, license_or_usage: candidate.licenseOrUsage, source_page_url: candidate.sourcePageUrl }) };
      }
    } catch (error) { console.error("[Image resolver] Wikimedia request failed:", error?.message || error); }
  }

  const providers = governmentImageProviderPriority(article.category).slice(0, 2);
  let lastProvider = "wikimedia";
  for (const provider of providers) {
    if (!remainingDeadlineMs(options.deadlineAt, 1000)) break;
    requestsUsed += 1;
    lastProvider = provider;
    try {
      const candidate = await searchProvider(provider, query, options);
      if (!candidate || !isProviderHost(candidate.url, provider) || !isProviderHost(candidate.sourcePageUrl, provider)) continue;
      return { image: candidate, searched: true, resolution: terminal("resolved", provider, requestsUsed, { attribution: candidate.attribution, license_or_usage: candidate.licenseOrUsage, source_page_url: candidate.sourcePageUrl }) };
    } catch (error) { console.error(`[Image resolver] ${provider} request failed:`, error?.message || error); }
  }
  return { image: null, searched: requestsUsed > 0, resolution: terminal("no_safe_image", lastProvider, requestsUsed, { license_or_usage: "no_verified_reusable_image" }) };
}
