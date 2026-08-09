const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const MIN_WIDTH = 900;
const MIN_HEIGHT = 450;

const STOP_WORDS = new Set([
  "about", "after", "against", "amid", "among", "and", "from", "into",
  "over", "says", "that", "the", "their", "this", "through", "towards",
  "under", "with", "will", "latest", "news", "official", "photograph",
  "photo", "image", "showing", "visible", "event", "current", "affairs",
]);

function clean(value = "") {
  return String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function tokens(value = "") {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3 && !STOP_WORDS.has(word));
}

function metadataText(value) {
  return clean(value?.value || value || "");
}

function hasReusableLicense(info) {
  const licenseText = [
    metadataText(info?.extmetadata?.LicenseShortName),
    metadataText(info?.extmetadata?.UsageTerms),
    metadataText(info?.extmetadata?.Copyrighted),
  ].join(" ");

  if (/non[ -]?commercial|no[ -]?derivatives|all rights reserved/i.test(licenseText)) {
    return false;
  }

  return /creative commons|cc[ -]?(?:by|zero|0)|public domain|gfdl|government open data|open government licen[cs]e/i.test(
    licenseText
  );
}

function candidateScore(page, query) {
  const info = page?.imageinfo?.[0];
  if (!info || !info.thumburl) return -1000;
  if (!String(info.mime || "").match(/^image\/(?:jpeg|png|webp)$/)) return -1000;
  if (Number(info.width) < MIN_WIDTH || Number(info.height) < MIN_HEIGHT) return -1000;
  if (!hasReusableLicense(info)) return -1000;

  const haystack = [
    page.title,
    metadataText(info.extmetadata?.ImageDescription),
    metadataText(info.extmetadata?.ObjectName),
    metadataText(info.extmetadata?.Categories),
  ].join(" ").toLowerCase();
  const queryTokens = [...new Set(tokens(query))];
  const matches = queryTokens.filter((word) => haystack.includes(word)).length;
  const ratio = queryTokens.length ? matches / queryTokens.length : 0;
  const queryYears = query.match(/\b(?:19|20)\d{2}\b/g) || [];
  const candidateYears = haystack.match(/\b(?:19|20)\d{2}\b/g) || [];
  // Current-event imagery must prove the requested year in Commons metadata.
  // A missing year is treated as ambiguous: no image is safer than a stale one.
  if (queryYears.length && !candidateYears.some((year) => queryYears.includes(year))) {
    return -1000;
  }
  const minimumMatches = Math.min(3, Math.max(2, Math.ceil(queryTokens.length * 0.35)));
  if (matches < minimumMatches || ratio < 0.28) return -1000;
  const landscapeBonus = Number(info.width) / Number(info.height) >= 1.25 ? 1.5 : 0;
  const photoBonus = String(info.mime).includes("jpeg") ? 1 : 0;
  const genericPenalty = /\b(icon|logo|coat of arms|blank map|symbol|generic|illustration)\b/i.test(haystack)
    ? 5
    : 0;
  return ratio * 14 + matches * 1.5 + landscapeBonus + photoBonus - genericPenalty;
}

async function searchCommons(query) {
  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: query,
    gsrnamespace: "6",
    gsrlimit: "15",
    gsrwhat: "text",
    prop: "imageinfo",
    iiprop: "url|mime|size|extmetadata",
    iiurlwidth: "1600",
    format: "json",
    origin: "*",
  });

  const response = await fetch(`${COMMONS_API}?${params.toString()}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "CurrentPulseAI/1.0 (UPSC educational current affairs; contact via website)",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(18000),
  });
  if (!response.ok) throw new Error(`Wikimedia Commons returned HTTP ${response.status}`);

  const payload = await response.json();
  return Object.values(payload?.query?.pages || {});
}

function createSearchQueries(imageQuery, title) {
  const primary = clean(imageQuery || title).slice(0, 180);
  const titleQuery = clean(title).replace(/[:|]/g, " ").slice(0, 160);
  const compact = [...new Set(tokens(primary))].slice(0, 9).join(" ");
  return [...new Set([primary, titleQuery, compact].filter((value) => value.length >= 8))];
}

export async function findRelevantCommonsImage(imageQuery, title) {
  const queries = createSearchQueries(imageQuery, title);
  let best = null;

  for (const query of queries) {
    try {
      const pages = await searchCommons(query);
      const ranked = pages
        .map((page) => ({ page, score: candidateScore(page, query) }))
        .filter((candidate) => candidate.score >= 5)
        .sort((first, second) => second.score - first.score);
      if (!ranked.length) continue;
      if (!best || ranked[0].score > best.score) best = ranked[0];
      if (best.score >= 8) break;
    } catch (error) {
      console.error(`[Relevant image] Commons search failed for "${query}":`, error?.message || error);
    }
  }

  if (!best) return null;
  const info = best.page.imageinfo[0];
  const license = metadataText(info.extmetadata?.LicenseShortName);
  const artist = metadataText(info.extmetadata?.Artist).replace(/<[^>]+>/g, " ");

  return {
    url: info.thumburl,
    sourceUrl: info.descriptionurl || info.url,
    caption: [clean(best.page.title).replace(/^File:/i, ""), artist, license]
      .filter(Boolean)
      .join(" · ")
      .slice(0, 500),
    score: best.score,
    license,
  };
}
