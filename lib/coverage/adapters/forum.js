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

const BASE_URL = "https://forumias.com";
const LIST_URL = `${BASE_URL}/blog/`;
const MAX_LINKS = 70;

const REJECT_TITLE = [
  /\b(?:test series|admit card|result|course|class|orientation|batch|cohort|simulator|admissions?|enroll|registration|register)\b/i,
  /\b(?:interview transcript|topper|mains marathon|answer writing|prelims marathon|quiz|mcq|magazine|compilation|download)\b/i,
  /^10\s*pm daily/i,
  /^9\s*pm upsc current affairs articles/i,
  /^must read news daily current affairs articles/i,
  /^current affairs\+?/i,
  /academy\.forumias/i,
];

function isRejected(title, url) {
  const value = cleanText(title);
  if (value.length < 14 || value.length > 190) return true;
  if (!url.includes("forumias.com/blog/")) return true;
  if (url === LIST_URL) return true;
  return REJECT_TITLE.some((pattern) => pattern.test(`${value} ${url}`));
}

function collectCandidateLinks(html) {
  const $ = loadHtml(html);
  const candidates = [];
  $("a[href]").each((_, anchor) => {
    const title = cleanText($(anchor).text());
    const url = absoluteUrl(BASE_URL, $(anchor).attr("href"));
    if (!url || isRejected(title, url)) return;

    // ForumIAS's current-affairs home exposes today's 7 PM editorials,
    // Factly/prelims items and 9 PM article links directly. Prefer these
    // editorial/article URLs rather than the gated 9 PM compilation page.
    candidates.push({ title, url });
  });

  return uniqueByUrl(candidates).slice(0, MAX_LINKS);
}

function pageDate($) {
  return (
    parseDate($("meta[property='article:published_time']").attr("content")) ||
    parseDate($("time").first().attr("datetime")) ||
    parseDate($("time").first().text()) ||
    null
  );
}

async function enrich(item) {
  try {
    const html = await fetchHtml(item.url);
    const $ = loadHtml(html);
    const title = cleanText($("h1").first().text()) || item.title;
    if (isRejected(title, item.url)) return null;

    const summary = extractStructuredText($, [
      ".entry-content",
      ".post-content",
      ".td-post-content",
      "main article",
      "article",
      "main",
    ]).slice(0, 28000);
    if (summary.length < 160) return null;

    const category = guessCategory(`${title} ${summary.slice(0, 1800)}`);
    return {
      source: "ForumIAS",
      title,
      summary,
      url: item.url,
      publishedAt: pageDate($),
      category,
      paper: guessPaper(category),
      keywords: [],
      imageUrl: null,
    };
  } catch (error) {
    console.error(`[ForumIAS adapter] ${item.url} failed:`, error?.message || error);
    return null;
  }
}

async function mapWithConcurrency(items, concurrency, handler) {
  const output = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      output[index] = await handler(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return output;
}

export async function fetchForumTopics() {
  const listHtml = await fetchHtml(LIST_URL);
  const links = collectCandidateLinks(listHtml);
  const topics = uniqueByUrl(
    (await mapWithConcurrency(links, 8, enrich)).filter(Boolean)
  ).slice(0, 220);

  if (!topics.length) {
    throw new Error("ForumIAS current-affairs homepage contained no usable editorial/factly/9 PM article links.");
  }
  return topics;
}
