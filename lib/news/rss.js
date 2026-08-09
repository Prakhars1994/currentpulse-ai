import * as cheerio from "cheerio";

const GOOGLE_NEWS_RSS = "https://news.google.com/rss/search";
const DEFAULT_MAX_RSS_AGE_HOURS = 96;
const FUTURE_CLOCK_SKEW_HOURS = 12;

export function cleanText(value = "") {
  return String(value)
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function stripHtml(value = "") {
  if (!value) return "";
  const $ = cheerio.load(value);
  return cleanText($.root().text());
}

function normalizeImageUrl(value = "") {
  const cleanedUrl = cleanText(value);

  if (!cleanedUrl) {
    return "";
  }

  try {
    const parsedUrl = new URL(cleanedUrl);

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return "";
    }

    return parsedUrl.toString();
  } catch {
    return "";
  }
}

function extractImageUrl(item, rawDescription = "") {
  const candidates = [
    item.find("media\\:content").first().attr("url"),
    item.find("media\\:thumbnail").first().attr("url"),
    item.find("enclosure").first().attr("url"),
    item.find("image").first().attr("href"),
    item.find("image url").first().text(),
  ];

  if (rawDescription) {
    const descriptionHtml = cheerio.load(rawDescription);

    candidates.push(
      descriptionHtml("img").first().attr("src"),
      descriptionHtml("img").first().attr("data-src")
    );
  }

  for (const candidate of candidates) {
    const imageUrl = normalizeImageUrl(candidate);

    if (imageUrl) {
      return imageUrl;
    }
  }

  return "";
}

export function createGoogleNewsFeedUrl(source, queryTerm) {
  const sourceQuery = [
    `site:${source.domain}`,
    source.extraQuery || "",
    `(${queryTerm})`,
    "when:2d",
  ]
    .filter(Boolean)
    .join(" ");

  const isIndia = source.region === "IN";
  const params = new URLSearchParams({
    q: sourceQuery,
    hl: isIndia ? "en-IN" : "en-US",
    gl: isIndia ? "IN" : "US",
    ceid: isIndia ? "IN:en" : "US:en",
  });

  return `${GOOGLE_NEWS_RSS}?${params.toString()}`;
}

export async function fetchWithTimeout(url, timeout = 15000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    return await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CurrentPulseAI/1.0; +https://currentpulse.ai)",
        Accept: "application/rss+xml, application/xml, text/xml, */*",
        "Accept-Language": "en-IN,en;q=0.9",
      },
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function removePublisherSuffix(title = "") {
  const parts = cleanText(title).split(" - ");
  return parts.length > 1 ? parts.slice(0, -1).join(" - ").trim() : cleanText(title);
}

function parseDate(value = "") {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function isFreshPublishedAt(
  publishedAt,
  maxAgeHours = Number(process.env.NEWS_MAX_AGE_HOURS || DEFAULT_MAX_RSS_AGE_HOURS)
) {
  if (!publishedAt) return true;

  const timestamp = new Date(publishedAt).getTime();
  if (Number.isNaN(timestamp)) return true;

  const ageMs = Date.now() - timestamp;
  const maxAgeMs = Math.max(24, Number(maxAgeHours) || DEFAULT_MAX_RSS_AGE_HOURS) * 60 * 60 * 1000;
  const futureSkewMs = FUTURE_CLOCK_SKEW_HOURS * 60 * 60 * 1000;

  // Feeds sometimes have small timezone/clock errors. Large future dates are bad metadata.
  if (ageMs < -futureSkewMs) return false;
  return ageMs <= maxAgeMs;
}

function createArticleId(sourceId, url, title) {
  const value = url || title;
  return `${sourceId}-${Buffer.from(value)
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 24)}`;
}

export function parseRss(xml, source) {
  const $ = cheerio.load(xml, { xmlMode: true });
  const articles = [];

  $("item, entry").each((_, element) => {
    const item = $(element);
    const rawTitle = cleanText(item.find("title").first().text());
    const linkText = cleanText(item.find("link").first().text());
    const linkHref = cleanText(item.find("link").first().attr("href"));
    const url = linkHref || linkText;
    const rawDescription =
      item.find("description").first().text() ||
      item.find("summary").first().text() ||
      item.find("content\\:encoded").first().text();
    const dateText =
      item.find("pubDate").first().text() ||
      item.find("published").first().text() ||
      item.find("updated").first().text();

const imageUrl = extractImageUrl(item, rawDescription);

    const title = removePublisherSuffix(rawTitle);
    const publishedAt = parseDate(cleanText(dateText));
    if (!title || !url) return;
    if (!isFreshPublishedAt(publishedAt)) return;

    articles.push({
      id: createArticleId(source.id, url, title),
      title,
      url,
      source: source.name,
      sourceId: source.id,
      sourceGroup: source.group,
      sourceDomain: source.domain,
      region: source.region,
      aggregator: "Google News RSS",
      description: stripHtml(rawDescription).slice(0, 1200),
imageUrl,
publishedAt,
    });
  });

  return articles;
}

export async function fetchSourceRss(source, queryTerms) {
  if (source.rssUrl) {
    try {
      const response = await fetchWithTimeout(source.rssUrl);
      if (!response.ok) {
        throw new Error(`${source.name} feed returned HTTP ${response.status}`);
      }

      return {
        articles: parseRss(await response.text(), source),
        errors: [],
      };
    } catch (error) {
      return {
        articles: [],
        errors: [error?.message || `Unable to fetch ${source.name}`],
      };
    }
  }

  const settled = await Promise.allSettled(
    queryTerms.map(async (term) => {
      const feedUrl = createGoogleNewsFeedUrl(source, term);
      const response = await fetchWithTimeout(feedUrl);
      if (!response.ok) {
        throw new Error(`${source.name} feed returned HTTP ${response.status}`);
      }
      return parseRss(await response.text(), source);
    })
  );

  const articles = settled.flatMap((result) =>
    result.status === "fulfilled" ? result.value : []
  );
  const errors = settled
    .filter((result) => result.status === "rejected")
    .map((result) => result.reason?.message || "Unknown feed error");

  return { articles, errors };
}
