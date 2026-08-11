import {
  absoluteUrl,
  cleanText,
  extractStructuredText,
  fetchHtml,
  guessCategory,
  guessPaper,
  loadHtml,
  parseDate,
  uniqueByUrl,
} from "@/lib/coverage/utils";
import {
  cleanTrustedCoverageText,
  extractPublishedDateFromText,
  isUsefulArticleImage,
} from "@/lib/coverage/contentCleaner";

const BASE_URL = "https://www.gktoday.in";
const LIST_URL = `${BASE_URL}/current-affairs/`;
const LIST_PAGES = 3;
const MAX_TOPICS = 60;
const DETAIL_CONCURRENCY = 6;

const REJECT_URL_PATTERNS = [
  /\/current-affairs\/?(?:$|[?#])/i,
  /\/current-affairs\/page\/\d+\/?/i,
  /\/current-affairs-quiz/i,
  /\/quiz/i,
  /\/category\//i,
  /\/tag\//i,
  /\/author\//i,
  /\/gk-questions/i,
  /\/ebooks?\//i,
  /\/about(?:-us)?\/?/i,
  /\/privacy/i,
  /\/contact/i,
];

const REJECT_TITLE_PATTERNS = [
  /^current affairs(?: today)?$/i,
  /^daily current affairs quiz/i,
  /^older posts?$/i,
  /^previous page$/i,
  /^next page$/i,
  /^read more$/i,
  /^important facts for exams$/i,
];

function isArticleLink(url, title) {
  const cleanTitle = cleanText(title);
  if (!url || !cleanTitle || cleanTitle.length < 8 || cleanTitle.length > 210) return false;
  if (REJECT_TITLE_PATTERNS.some((pattern) => pattern.test(cleanTitle))) return false;

  try {
    const parsed = new URL(url);
    if (!/(?:^|\.)gktoday\.in$/i.test(parsed.hostname)) return false;
    if (REJECT_URL_PATTERNS.some((pattern) => pattern.test(parsed.pathname + parsed.search))) return false;
    // GKToday CA articles use clean top-level slugs. Avoid generic site utilities.
    const segments = parsed.pathname.split("/").filter(Boolean);
    return segments.length === 1;
  } catch {
    return false;
  }
}

function listingDate(text = "") {
  const value = cleanText(text);
  const match = value.match(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+20\d{2}\b/i
  );
  return match ? parseDate(`${match[0]} 06:00:00 +05:30`) : null;
}

function findListingContainer($, heading) {
  let node = $(heading);
  for (let depth = 0; depth < 6; depth += 1) {
    const parent = node.parent();
    if (!parent.length) break;
    const text = cleanText(parent.text());
    if (/\b20\d{2}\b/.test(text) && text.length >= 100 && text.length <= 2500) return parent;
    node = parent;
  }
  return $(heading).parent();
}

function collectListingItems(html) {
  const $ = loadHtml(html);
  const items = [];

  $("main h2 a[href], main h3 a[href], article h2 a[href], article h3 a[href], .entry-title a[href], .post-title a[href]")
    .each((_, anchor) => {
      const title = cleanText($(anchor).text());
      const url = absoluteUrl(BASE_URL, $(anchor).attr("href"));
      if (!isArticleLink(url, title)) return;

      const container = findListingContainer($, anchor);
      const text = cleanTrustedCoverageText(container.text());
      const summary = cleanTrustedCoverageText(text.replace(title, "")).slice(0, 3000);
      const publishedAt = listingDate(text);
      if (!publishedAt) return;

      items.push({ title, url, summary, publishedAt });
    });

  return uniqueByUrl(items);
}

function extractCategoryLabel($) {
  const candidates = $("a[href*='/category/']")
    .toArray()
    .map((node) => cleanText($(node).text()))
    .filter((value) => /current affairs|science|technology|environment|biodiversity|econom|bank|defen[cs]e|legal|constitution|international|world|scheme|sport|culture|geography|report|index/i.test(value));
  return candidates[0] || "";
}

async function enrichTopic(item) {
  try {
    const html = await fetchHtml(item.url, 18000);
    const $ = loadHtml(html);
    const title = cleanText($("h1").first().text()) || item.title;
    let summary = extractStructuredText($, [
      "[itemprop='articleBody']",
      ".entry-content",
      ".post-content",
      ".td-post-content",
      ".article-content",
      "article .inside-article",
      "article",
      "main article",
    ]).slice(0, 28000);

    summary = cleanTrustedCoverageText(summary)
      .replace(/\bCategory:\s*[^\n]{0,120}$/i, "")
      .trim();

    if (summary.length < 120) summary = item.summary;
    if (!summary || summary.length < 120) return null;

    const dateText =
      cleanText($("meta[property='article:published_time']").attr("content")) ||
      cleanText($("time").first().attr("datetime")) ||
      cleanText($("time").first().text());
    const publishedAt =
      parseDate(dateText) ||
      extractPublishedDateFromText(cleanText($("body").text())) ||
      item.publishedAt;

    const categoryLabel = extractCategoryLabel($);
    const category = guessCategory(`${categoryLabel} ${title} ${summary.slice(0, 1800)}`);
    const imageUrl = absoluteUrl(
      BASE_URL,
      $("meta[property='og:image']").attr("content") || $("article img").first().attr("src")
    );

    return {
      source: "GKToday",
      title,
      summary,
      url: item.url,
      publishedAt,
      category,
      paper: guessPaper(category),
      keywords: [],
      imageUrl: isUsefulArticleImage(imageUrl) ? imageUrl : null,
    };
  } catch (error) {
    console.error(`[GKToday adapter] ${item.url} failed:`, error?.message || error);
    if (!item.summary || item.summary.length < 120) return null;
    const category = guessCategory(`${item.title} ${item.summary}`);
    return {
      source: "GKToday",
      title: item.title,
      summary: item.summary,
      url: item.url,
      publishedAt: item.publishedAt,
      category,
      paper: guessPaper(category),
      keywords: [],
      imageUrl: null,
    };
  }
}

async function mapWithConcurrency(items, concurrency, handler) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await handler(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );
  return results;
}

export async function fetchGkTodayTopics() {
  const pageUrls = [
    LIST_URL,
    ...Array.from({ length: LIST_PAGES - 1 }, (_, index) => `${LIST_URL}page/${index + 2}/`),
  ];

  const pages = await Promise.allSettled(pageUrls.map((url) => fetchHtml(url, 18000)));
  const listingItems = uniqueByUrl(
    pages
      .filter((result) => result.status === "fulfilled")
      .flatMap((result) => collectListingItems(result.value))
  ).slice(0, MAX_TOPICS);

  if (!listingItems.length) {
    throw new Error("GKToday Current Affairs listing contained no usable article links.");
  }

  const topics = await mapWithConcurrency(listingItems, DETAIL_CONCURRENCY, enrichTopic);
  const usable = uniqueByUrl(topics.filter(Boolean));
  if (!usable.length) {
    throw new Error("GKToday Current Affairs articles could not be read from the deployment environment.");
  }
  return usable;
}
