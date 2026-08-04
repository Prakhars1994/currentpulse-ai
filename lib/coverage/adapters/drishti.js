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

const BASE_URL = "https://www.drishtiias.com";
const LIST_URL = `${BASE_URL}/daily-updates/daily-news-analysis`;
const MAX_TOPICS = 10;

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

  if (isRejectedTitle(title) || summary.length < 120) {
    return null;
  }

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

export async function fetchDrishtiTopics() {
  const html = await fetchHtml(LIST_URL);
  const $ = loadHtml(html);
  const links = collectLinks($);

  const settled = await Promise.allSettled(links.map(enrichTopic));

  return settled
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value)
    .filter(Boolean)
    .filter((topic) => topic.title && topic.summary.length >= 120);
}
