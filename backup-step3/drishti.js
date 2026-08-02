import {
  absoluteUrl,
  cleanText,
  extractMainText,
  fetchHtml,
  guessCategory,
  guessPaper,
  loadHtml,
  parseDate,
  uniqueByUrl,
} from "@/lib/coverage/utils";

const BASE_URL = "https://www.drishtiias.com";
const LIST_URL = `${BASE_URL}/daily-updates/daily-news-analysis`;
const MAX_TOPICS = 10;

function collectLinks($) {
  const links = [];

  $("a[href]").each((_, element) => {
    const href = absoluteUrl(BASE_URL, $(element).attr("href"));
    const title = cleanText($(element).text());

    if (!href || !title || title.length < 12) return;
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

  const summary = extractMainText($, [
    ".content-body",
    ".article-detail",
    ".news-analysis-content",
    "main article",
    "article",
    ".content",
    "main",
  ]).slice(0, 28000);

  const dateText =
    cleanText($("time").first().attr("datetime")) ||
    cleanText($("time").first().text()) ||
    cleanText($("meta[property='article:published_time']").attr("content"));

  const imageUrl = absoluteUrl(
    BASE_URL,
    $("meta[property='og:image']").attr("content") || $("article img").first().attr("src")
  );

  const category = guessCategory(`${title} ${summary.slice(0, 1200)}`);

  return {
    source: "Drishti IAS",
    title,
    summary,
    url: item.url,
    publishedAt: parseDate(dateText),
    category,
    paper: guessPaper(category),
    keywords: [],
    imageUrl: imageUrl || null,
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
    .filter((topic) => topic.title && topic.summary.length >= 120);
}
