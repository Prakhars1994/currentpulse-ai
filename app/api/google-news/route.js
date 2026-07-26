import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GOOGLE_NEWS_BASE_URL =
  "https://news.google.com/rss/search";

const NEWS_QUERIES = [
  "India government policy",
  "India economy RBI",
  "India environment climate",
  "India science technology ISRO",
  "India international relations",
  "India defence security",
  "India agriculture",
  "India health education governance",
];

const EXCLUDED_WORDS = [
  "celebrity",
  "actor",
  "actress",
  "movie",
  "film",
  "box office",
  "web series",
  "fashion",
  "horoscope",
  "astrology",
  "viral video",
  "entertainment",
  "cricket score",
  "football score",
  "lottery",
  "recipe",
];

const PRIORITY_WORDS = [
  "government",
  "cabinet",
  "supreme court",
  "parliament",
  "ministry",
  "policy",
  "scheme",
  "mission",
  "bill",
  "act",
  "rules",
  "constitution",
  "governance",
  "economy",
  "economic",
  "rbi",
  "inflation",
  "gdp",
  "banking",
  "finance",
  "agriculture",
  "farmer",
  "environment",
  "climate",
  "biodiversity",
  "forest",
  "energy",
  "renewable",
  "science",
  "technology",
  "isro",
  "space",
  "defence",
  "security",
  "international",
  "agreement",
  "trade",
  "infrastructure",
  "railway",
  "health",
  "education",
  "tribal",
  "women",
  "social justice",
  "disaster",
  "water",
  "digital",
  "artificial intelligence",
  "semiconductor",
  "employment",
  "welfare",
];

function cleanText(value = "") {
  return String(value)
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function createFeedUrl(query) {
  const params = new URLSearchParams({
    q: query,
    hl: "en-IN",
    gl: "IN",
    ceid: "IN:en",
  });

  return `${GOOGLE_NEWS_BASE_URL}?${params.toString()}`;
}

function isExcluded(title = "") {
  const lowerTitle = title.toLowerCase();

  return EXCLUDED_WORDS.some((word) =>
    lowerTitle.includes(word)
  );
}

function getPriorityScore(title = "") {
  const lowerTitle = title.toLowerCase();

  return PRIORITY_WORDS.reduce((score, word) => {
    return lowerTitle.includes(word) ? score + 1 : score;
  }, 0);
}

function extractPublisher(title = "") {
  const parts = title.split(" - ");

  if (parts.length < 2) {
    return "";
  }

  return cleanText(parts[parts.length - 1]);
}

function removePublisherFromTitle(title = "") {
  const parts = title.split(" - ");

  if (parts.length < 2) {
    return cleanText(title);
  }

  return cleanText(parts.slice(0, -1).join(" - "));
}

function createArticleId(url = "") {
  return `google-${Buffer.from(url)
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 24)}`;
}

function parseGoogleNewsFeed(xml, query) {
  const $ = cheerio.load(xml, {
    xmlMode: true,
  });

  const articles = [];

  $("item").each((index, element) => {
    const item = $(element);

    const rawTitle = cleanText(
      item.find("title").first().text()
    );

    const url = cleanText(
      item.find("link").first().text()
    );

    const pubDateText = cleanText(
      item.find("pubDate").first().text()
    );

    if (!rawTitle || !url || isExcluded(rawTitle)) {
      return;
    }

    const title = removePublisherFromTitle(rawTitle);
    const publisher = extractPublisher(rawTitle);

    let publishedAt = null;

    if (pubDateText) {
      const parsedDate = new Date(pubDateText);

      if (!Number.isNaN(parsedDate.getTime())) {
        publishedAt = parsedDate.toISOString();
      }
    }

    articles.push({
      id: createArticleId(url),
      title,
      url,
      source: publisher || "Google News",
      aggregator: "Google News",
      query,
      publishedAt,
      priorityScore: getPriorityScore(title),
    });
  });

  return articles;
}

function removeDuplicates(articles) {
  const seenTitles = new Set();
  const seenUrls = new Set();

  return articles.filter((article) => {
    const titleKey = article.title
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

    if (
      seenTitles.has(titleKey) ||
      seenUrls.has(article.url)
    ) {
      return false;
    }

    seenTitles.add(titleKey);
    seenUrls.add(article.url);

    return true;
  });
}

async function fetchWithTimeout(url, timeout = 15000) {
  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeout);

  try {
    return await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; CurrentPulseAI/1.0)",
        Accept:
          "application/rss+xml, application/xml, text/xml, */*",
      },
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchFeed(query) {
  const url = createFeedUrl(query);
  const response = await fetchWithTimeout(url);

  if (!response.ok) {
    console.error(
      `Google News query failed: ${query}, status ${response.status}`
    );

    return [];
  }

  const xml = await response.text();

  if (!xml.trim()) {
    return [];
  }

  return parseGoogleNewsFeed(xml, query);
}

async function collectNews() {
  const results = await Promise.allSettled(
    NEWS_QUERIES.map((query) => fetchFeed(query))
  );

  const articles = results.flatMap((result) => {
    if (result.status === "fulfilled") {
      return result.value;
    }

    console.error(
      "Google News feed error:",
      result.reason
    );

    return [];
  });

  const recentCutoff =
    Date.now() - 48 * 60 * 60 * 1000;

  return removeDuplicates(articles)
    .filter((article) => {
      if (!article.publishedAt) {
        return true;
      }

      return (
        new Date(article.publishedAt).getTime() >=
        recentCutoff
      );
    })
    .sort((first, second) => {
      if (
        second.priorityScore !== first.priorityScore
      ) {
        return (
          second.priorityScore -
          first.priorityScore
        );
      }

      return (
        new Date(second.publishedAt || 0).getTime() -
        new Date(first.publishedAt || 0).getTime()
      );
    })
    .slice(0, 50);
}

export async function GET() {
  try {
    const articles = await collectNews();

    return NextResponse.json({
      success: true,
      source: "Google News",
      collectedAt: new Date().toISOString(),
      count: articles.length,
      articles,
    });
  } catch (error) {
    console.error(
      "Google News collector error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error?.name === "AbortError"
            ? "Google News took too long to respond."
            : error?.message ||
              "Failed to collect Google News.",
        articles: [],
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  return GET();
}