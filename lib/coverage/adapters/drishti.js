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
import { isOnHistoryDate, normalizeHistoryDate } from "@/lib/automation/history";
import {
  cleanTrustedCoverageText,
  extractPublishedDateFromText,
  isUsefulArticleImage,
} from "@/lib/coverage/contentCleaner";

const BASE_URL = "https://www.drishtiias.com";
const LIST_URL = `${BASE_URL}/daily-updates/daily-news-analysis`;
// Previous value (10) silently dropped valid daily CA items.
const MAX_TOPICS = 60;
const REJECT_TITLE_PATTERNS = [
  /^about upsc/i,
  /^upsc civil services examination/i,
  /^daily updates?$/i,
  /^daily news analysis$/i,
  /^read more$/i,
  /^prev(?:ious)?$/i,
  /^next$/i,
];

function isRejectedTitle(title) {
  const value = cleanText(title);
  return !value || REJECT_TITLE_PATTERNS.some((pattern) => pattern.test(value));
}

function collectLinks($) {
  const links = [];
  $("a[href]").each((_, element) => {
    const href = absoluteUrl(BASE_URL, $(element).attr("href"));
    const title = cleanText($(element).text());

    if (!href || !title || title.length < 12 || isRejectedTitle(title)) return;
    if (!href.includes("/daily-updates/daily-news-analysis/")) return;

    links.push({ title, url: href });
  });

  return uniqueByUrl(links).slice(0, MAX_TOPICS);
}

async function enrichTopic(item) {
  const html = await fetchHtml(item.url);
  const $ = loadHtml(html);
  const title =
    cleanText($("h1").first().text()) ||
    cleanText($("h2").first().text()) ||
    item.title;

  const rawSummary = extractStructuredText($, [
    ".content-body",
    ".article-detail",
    ".news-analysis-content",
    "main article",
    "article",
    ".content",
    "main",
  ]).slice(0, 28000);

  const summary = cleanTrustedCoverageText(rawSummary);
  const dateText =
    cleanText($("time").first().attr("datetime")) ||
    cleanText($("time").first().text()) ||
    cleanText($("meta[property='article:published_time']").attr("content"));

  const imageUrl = absoluteUrl(
    BASE_URL,
    $("meta[property='og:image']").attr("content") || $("article img").first().attr("src")
  );

  const category = guessCategory(`${title} ${summary.slice(0, 1200)}`);
  if (isRejectedTitle(title) || summary.length < 120) return null;

  return {
    source: "Drishti IAS",
    title,
    summary,
    url: item.url,
    publishedAt:
      parseDate(dateText) ||
      extractPublishedDateFromText(`${title} ${summary.slice(0, 300)}`),
    category,
    paper: guessPaper(category),
    keywords: [],
    imageUrl: isUsefulArticleImage(imageUrl) ? imageUrl : null,
  };
}

async function mapWithConcurrency(items, limit, handler) {
  const results = new Array(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index++;
      results[current] = await handler(items[current], current);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker())
  );
  return results;
}

export async function fetchDrishtiTopics({ historyDate = "" } = {}) {
  const date = normalizeHistoryDate(historyDate);
  // Drishti article URLs are not date-addressable. Historical repair therefore
  // uses a small bounded archive scan and filters by the source publication
  // date after enrichment; it never repeatedly reloads only the first page.
  const archivePages = date
    ? Array.from(
        { length: 6 },
        (_, index) => (index === 0 ? LIST_URL : `${LIST_URL}?page=${index + 1}`)
      )
    : [LIST_URL];
  const pageResults = await Promise.allSettled(
    archivePages.map(async (url) => collectLinks(loadHtml(await fetchHtml(url))))
  );
  const links = uniqueByUrl(
    pageResults.flatMap((result) =>
      result.status === "fulfilled" ? result.value : []
    )
  ).slice(0, date ? 180 : MAX_TOPICS);
  const settled = await mapWithConcurrency(links, 8, async (link) => {
    try {
      return { status: "fulfilled", value: await enrichTopic(link) };
    } catch (error) {
      return { status: "rejected", reason: error };
    }
  });

  return settled
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value)
    .filter(Boolean)
    .filter((topic) => topic.title && topic.summary.length >= 120)
    .filter((topic) => !date || isOnHistoryDate(topic.publishedAt, date));
}
