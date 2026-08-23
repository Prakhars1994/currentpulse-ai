import * as cheerio from "cheerio";
import { historyDateWindow } from "../automation/history.js";

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

export function createGoogleNewsFeedUrl(source, queryTerm, options = {}) {
  const historyWindow = historyDateWindow(options.historyDate);
  const sourceQuery = [
    `site:${source.domain}`,
    source.extraQuery || "",
    queryTerm ? `(${queryTerm})` : "",
    historyWindow
      ? `after:${historyWindow.date} before:${historyWindow.nextDate}`
      : "when:2d",
  ]
    .filter(Boolean)
    .join(" ")
    .replace(
      historyWindow ? /\bwhen:\d+d\b/gi : /$^/,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();

  const isIndia = source.region === "IN";
  const params = new URLSearchParams({
    q: sourceQuery,
    hl: isIndia ? "en-IN" : "en-US",
    gl: isIndia ? "IN" : "US",
    ceid: isIndia ? "IN:en" : "US:en",
  });

  return `${GOOGLE_NEWS_RSS}?${params.toString()}`;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const RETRYABLE_RSS_STATUS = new Set([429, 500, 502, 503, 504]);

export async function fetchWithTimeout(
  url,
  timeout = Math.max(
    6_000,
    Number(process.env.NEWS_FETCH_TIMEOUT_MS) || 15_000
  )
) {
  let lastError = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; CurrentPulseAI/1.0; +https://cp.vliab.workers.dev)",
          Accept: "application/rss+xml, application/xml, text/xml, */*",
          "Accept-Language": "en-IN,en;q=0.9",
        },
        cache: "no-store",
        signal: controller.signal,
      });

      const text = await response.text();

      if (
        response.ok ||
        !RETRYABLE_RSS_STATUS.has(response.status) ||
        attempt === 3
      ) {
        return { response, text };
      }

      lastError = new Error(
        `RSS temporarily returned HTTP ${response.status}`
      );
    } catch (error) {
      lastError = error;
      if (attempt === 3) throw error;
    } finally {
      clearTimeout(timeoutId);
    }

    await wait(1200 * attempt);
  }

  throw lastError || new Error("RSS fetch failed");
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

export function parseRss(xml, source, options = {}) {
  const $ = cheerio.load(xml, { xmlMode: true });
  const articles = [];

  $("item, entry").each((_, element) => {
    const item = $(element);
    const rawTitle = cleanText(item.find("title").first().text());
    const linkText = cleanText(item.find("link").first().text());
    const linkHref = cleanText(
      item.find('link[rel="alternate"]').first().attr("href") ||
      item.find("link").first().attr("href")
    );
    const url = linkHref || linkText;
    const rawDescription =
      item.find("description").first().text() ||
      item.find("summary").first().text() ||
      item.find("content").first().text() ||
      item.find("content\\:encoded").first().text();
    const author =
      cleanText(item.find("author > name").first().text()) ||
      cleanText(item.find("dc\\:creator").first().text()) ||
      cleanText(item.find("author").first().text());
    const dateText =
      item.find("pubDate").first().text() ||
      item.find("published").first().text() ||
      item.find("updated").first().text();

const imageUrl = extractImageUrl(item, rawDescription);

    const title = source.preserveTitle
      ? rawTitle
      : removePublisherSuffix(rawTitle);
    const publishedAt = parseDate(cleanText(dateText));
    if (!title || !url) return;
    if (!options.historyDate && !isFreshPublishedAt(publishedAt)) return;

    articles.push({
      id: createArticleId(source.id, url, title),
      title,
      url,
      source: source.name,
      sourceId: source.id,
      sourceGroup: source.group,
      sourceDomain: source.domain,
      region: source.region,
      aggregator: source.rssUrl ? `${source.name} RSS/Atom` : "Google News RSS",
      description: stripHtml(rawDescription).slice(0, 1200),
      author,
imageUrl,
publishedAt,
    });
  });

  return articles;
}

function isWithinHistoryWindow(publishedAt, historyDate) {
  const window = historyDateWindow(historyDate);
  if (!window) return true;
  const timestamp = new Date(publishedAt || 0).getTime();
  return (
    Number.isFinite(timestamp) &&
    timestamp >= new Date(window.start).getTime() &&
    timestamp < new Date(window.end).getTime()
  );
}

export function parseRssForWindow(xml, source, options = {}) {
  const historyWindow = historyDateWindow(options.historyDate);
  const articles = parseRss(xml, source, options);
  return historyWindow
    ? articles.filter((article) =>
        isWithinHistoryWindow(article.publishedAt, historyWindow.date)
      )
    : articles;
}

export async function fetchSourceRss(source, queryTerms, options = {}) {
  // A publisher's rolling RSS feed is useful for fresh collection but usually
  // cannot answer an exact historical day. Historical repair therefore uses
  // the date-bounded Google News query for every source, then filters again by
  // the India-day window below.
  if (source.rssUrl && !options.historyDate) {
    try {
      const { response, text } = await fetchWithTimeout(source.rssUrl);
      if (!response.ok) {
        throw new Error(`${source.name} feed returned HTTP ${response.status}`);
      }

      return {
        articles: parseRssForWindow(text, source, options),
        errors: [],
      };
    } catch (error) {
      return {
        articles: [],
        errors: [error?.message || `Unable to fetch ${source.name}`],
      };
    }
  }

  const effectiveTerms = Array.isArray(source.queryTerms) && source.queryTerms.length
    ? source.queryTerms
    : queryTerms;
  const settled = await Promise.allSettled(
    effectiveTerms.map(async (term) => {
      const feedUrl = createGoogleNewsFeedUrl(source, term, options);
      const { response, text } = await fetchWithTimeout(feedUrl);
      if (!response.ok) {
        throw new Error(`${source.name} feed returned HTTP ${response.status}`);
      }
      return parseRssForWindow(text, source, options);
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
