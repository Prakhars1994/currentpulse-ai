import { deadlineSignal, remainingDeadlineMs } from "@/lib/network/deadline";

export const TERMINAL_IMAGE_RESOLUTION_STATUSES = new Set(["resolved","no_safe_image","preserved_existing","rejected"]);

const PROVIDERS = {
  wikimedia: { label: "Wikimedia Commons", usage: "wikimedia_commons_file_license", imageHosts: ["upload.wikimedia.org", "commons.wikimedia.org"] },
  isro: { label: "ISRO", usage: "government_public_domain_review_required", search: (q) => `https://www.isro.gov.in/search.html?search=${encodeURIComponent(q)}`, imageHosts: ["isro.gov.in"] },
  nasa: { label: "NASA", usage: "nasa_media_usage", search: (q) => `https://images-api.nasa.gov/search?q=${encodeURIComponent(q)}&media_type=image&page_size=10`, imageHosts: ["images-assets.nasa.gov", "nasa.gov"] },
  noaa: { label: "NOAA", usage: "noaa_public_domain_review_required", search: (q) => `https://www.noaa.gov/search?search_api_fulltext=${encodeURIComponent(q)}`, imageHosts: ["noaa.gov"] },
  usgs: { label: "USGS", usage: "usgs_public_domain_review_required", search: (q) => `https://www.usgs.gov/search?keywords=${encodeURIComponent(q)}`, imageHosts: ["usgs.gov"] },
  pib: { label: "PIB", usage: "pib_government_media_review_required", search: (q) => `https://pib.gov.in/PressReleaseIframePage.aspx?PRID=&reg=3&lang=2&search=${encodeURIComponent(q)}`, imageHosts: ["pib.gov.in"] },
  usda_ars: { label: "USDA ARS", usage: "usda_public_domain_review_required", search: (q) => `https://www.ars.usda.gov/search/?q=${encodeURIComponent(q)}`, imageHosts: ["usda.gov"] },
  nps: { label: "National Park Service", usage: "nps_public_domain_review_required", search: (q) => `https://www.nps.gov/findapark/index.htm?query=${encodeURIComponent(q)}`, imageHosts: ["nps.gov"] },
  cdc_nih: { label: "CDC/NIH", usage: "federal_public_domain_review_required", search: (q) => `https://search.cdc.gov/search/?query=${encodeURIComponent(q)}`, imageHosts: ["cdc.gov", "nih.gov"] },
};

const QUERY_STOP = new Set(["India","Indian","CurrentPulse","News","Desk","Prime","Minister","President","Government","Official","September","August","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]);
function clean(value = "") { return String(value || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim(); }
function hostname(value = "") { try { return new URL(value).hostname.toLowerCase(); } catch { return ""; } }
function isProviderHost(url, provider) { const host = hostname(url); return PROVIDERS[provider].imageHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`)); }
function safeWikimediaLicense(value = "") { const license = clean(value).toLowerCase(); if (!license || /non.?commercial|no.?derivatives|all rights reserved|fair use/.test(license)) return false; return /public domain|cc0|creative commons|cc by|cc-by|gfdl/.test(license); }
function unique(values = []) { return [...new Set(values.filter(Boolean))]; }
function entitySearchTerms(article = {}) {
  const text = clean([article.title, article.why_news, article.content, article.static_foundation].filter(Boolean).join(" ")).slice(0, 5000);
  const dateline = text.match(/\b([A-Z][A-Z .'-]{2,28})\s*\|/)?.[1]?.trim();
  const phrases = [...text.matchAll(/\b([A-Z][a-z]{2,}(?:\s+(?:[A-Z][a-z]{2,}|of|the|and)){0,3})\b/g)]
    .map((match) => match[1].trim())
    .filter((value) => !QUERY_STOP.has(value) && value.length > 3 && value.length < 70);
  const titleTokens = clean(article.title).split(/[^A-Za-z0-9-]+/).filter((token) => token.length > 4 && !QUERY_STOP.has(token)).slice(0, 4);
  const terms = unique([dateline, ...phrases.slice(0, 6), ...titleTokens, clean(article.category)]).slice(0, 7);
  return terms.join(" ").slice(0, 180) || clean(article.title).slice(0, 180);
}

export function isTerminalImageResolution(value) { return Boolean(value && TERMINAL_IMAGE_RESOLUTION_STATUSES.has(value.status)); }
export function governmentImageProviderPriority(category = "") {
  const value = String(category).toLowerCase();
  if (/space|science/.test(value)) return ["isro", "nasa"];
  if (/environment|disaster|geography/.test(value)) return ["noaa", "usgs", "nasa"];
  if (/agri|rural|food/.test(value)) return ["pib", "usda_ars"];
  if (/health|social/.test(value)) return ["pib", "cdc_nih"];
  if (/wildlife|nature|forest/.test(value)) return ["nps", "usgs"];
  return ["pib"];
}
function terminal(status, provider, requestsUsed, extra = {}) { return { status, provider: provider || "currentpulse_fallback", attempted_at: new Date().toISOString(), requests_used: requestsUsed, attribution: extra.attribution || "", license_or_usage: extra.license_or_usage || "", source_page_url: extra.source_page_url || "", search_query: extra.search_query || "" }; }
function nasaCandidate(payload) {
  const item = payload?.collection?.items?.find((entry) => (entry.links || []).some((candidate) => candidate?.rel === "preview" && isProviderHost(candidate.href, "nasa")));
  if (!item) return null; const imageUrl = item.links.find((entry) => entry.rel === "preview").href; const data = item.data?.[0] || {}; const title = clean(data.title); const description = clean(data.description);
  return { url: imageUrl, sourcePageUrl: item.href || "", attribution: ["NASA", title].filter(Boolean).join(" · ").slice(0, 500), licenseOrUsage: PROVIDERS.nasa.usage, alt: title || description, storagePolicy: "hotlink" };
}
function wikimediaCandidate(payload) {
  for (const page of Object.values(payload?.query?.pages || {})) {
    const info = page?.imageinfo?.[0]; const meta = info?.extmetadata || {}; const url = info?.thumburl || info?.url || ""; const sourcePageUrl = info?.descriptionurl || page?.canonicalurl || "";
    if (!url || !sourcePageUrl || !isProviderHost(url, "wikimedia") || !isProviderHost(sourcePageUrl, "wikimedia")) continue;
    const license = clean(meta.LicenseShortName?.value || meta.UsageTerms?.value || ""); if (!safeWikimediaLicense(license)) continue;
    const artist = clean(meta.Artist?.value || meta.Credit?.value || ""); const title = clean(meta.ObjectName?.value || page?.title?.replace(/^File:/i, "") || ""); const description = clean(meta.ImageDescription?.value || "");
    return { url, sourcePageUrl, attribution: [title, artist, license, "Wikimedia Commons"].filter(Boolean).join(" · ").slice(0, 700), licenseOrUsage: license, alt: description || title, storagePolicy: "hotlink" };
  }
  return null;
}
async function searchWikimedia(query, options) {
  const signal = deadlineSignal(options.deadlineAt, 7000); if (!signal) return null;
  const params = new URLSearchParams({ action: "query", generator: "search", gsrsearch: query, gsrnamespace: "6", gsrlimit: "8", prop: "imageinfo|info", iiprop: "url|extmetadata", iiurlwidth: "900", inprop: "url", format: "json", origin: "*" });
  const response = await (options.fetch || fetch)(`https://commons.wikimedia.org/w/api.php?${params.toString()}`, { headers: { Accept: "application/json", "User-Agent": "CurrentPulse/1.0 Wikimedia image resolver" }, cache: "force-cache", next: { revalidate: 604800 }, signal });
  if (!response.ok) return null; return wikimediaCandidate(await response.json());
}
async function searchProvider(provider, query, options) {
  const config = PROVIDERS[provider]; const signal = deadlineSignal(options.deadlineAt, 7000); if (!signal) return null;
  const response = await (options.fetch || fetch)(config.search(query), { headers: { Accept: provider === "nasa" ? "application/json" : "text/html", "User-Agent": "CurrentPulse/1.0 government-media resolver" }, cache: "no-store", signal });
  if (!response.ok || provider !== "nasa") return null; return nasaCandidate(await response.json());
}

export async function resolveGovernmentArticleImage(article = {}, options = {}) {
  const existing = article.image_resolution; if (isTerminalImageResolution(existing)) return { image: null, resolution: existing, searched: false };
  if (options.preserveExisting) return { image: null, resolution: terminal("preserved_existing", "existing", 0, { attribution: article.image_caption, source_page_url: article.image_source_url }), searched: false };
  const query = entitySearchTerms(article); let requestsUsed = 0;
  if (remainingDeadlineMs(options.deadlineAt, 1000)) { requestsUsed += 1; try { const candidate = await searchWikimedia(query, options); if (candidate) return { image: candidate, searched: true, query, resolution: terminal("resolved", "wikimedia", requestsUsed, { attribution: candidate.attribution, license_or_usage: candidate.licenseOrUsage, source_page_url: candidate.sourcePageUrl, search_query: query }) }; } catch (error) { console.error("[Image resolver] Wikimedia request failed:", error?.message || error); } }
  const providers = governmentImageProviderPriority(article.category).slice(0, 1); let lastProvider = "wikimedia";
  for (const provider of providers) { if (!remainingDeadlineMs(options.deadlineAt, 1000)) break; requestsUsed += 1; lastProvider = provider; try { const candidate = await searchProvider(provider, query, options); if (!candidate || !isProviderHost(candidate.url, provider) || !isProviderHost(candidate.sourcePageUrl, provider)) continue; return { image: candidate, searched: true, query, resolution: terminal("resolved", provider, requestsUsed, { attribution: candidate.attribution, license_or_usage: candidate.licenseOrUsage, source_page_url: candidate.sourcePageUrl, search_query: query }) }; } catch (error) { console.error(`[Image resolver] ${provider} request failed:`, error?.message || error); } }
  return { image: null, searched: requestsUsed > 0, query, resolution: terminal("no_safe_image", lastProvider, requestsUsed, { license_or_usage: "no_verified_reusable_image", search_query: query }) };
}
