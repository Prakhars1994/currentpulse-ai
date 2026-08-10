import {
  absoluteUrl,
  cleanText,
  fetchHtml,
  guessCategory,
  guessPaper,
  loadHtml,
  parseDate,
  uniqueByUrl,
} from "@/lib/coverage/utils";

const BASE_URL = "https://visionias.in";
const LIST_URL = `${BASE_URL}/current-affairs/upsc-daily-news-summary`;
// Previous value (20) could truncate valid Vision daily items.
const MAX_TOPICS = 80;

const REJECT_TITLES = new Set([
  "notes ecosystem",
  "daily news summary",
  "news summary",
  "previous day",
  "next day",
  "read more",
]);

function extractDate(text) {
  const match = cleanText(text).match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  return match ? parseDate(match[1]) : null;
}

function removeMetadata(text, title) {
  return cleanText(text)
    .replace(title, "")
    .replace(/\b(The Hindu|The Indian Express|Business Standard|The Economic Times)\b/gi, " ")
    .replace(/\b20\d{2}-\d{2}-\d{2}\b/g, " ")
    .replace(/\bLink\s*:-?.*$/i, " ")
    .replace(/\s*\|\s*/g, " ")
    .trim();
}

function findContainer($, heading) {
  let node = $(heading);
  for (let depth = 0; depth < 6; depth += 1) {
    const parent = node.parent();
    if (!parent.length) break;

    const text = cleanText(parent.text());
    const hasLink = parent.find("a[href^='http']").length > 0;
    if (text.length >= 140 && text.length <= 4000 && hasLink) return parent;
    node = parent;
  }
  return $(heading).parent();
}

function collectTopics($) {
  const topics = [];
  $("h4, h5, h6").each((_, heading) => {
    const title = cleanText($(heading).text()).replace(/^#+\s*/, "");
    if (title.length < 20 || REJECT_TITLES.has(title.toLowerCase())) return;

    const container = findContainer($, heading).clone();
    container.find("script, style, nav, form, button, svg").remove();
    const fullText = cleanText(container.text());
    const externalLink = container
      .find("a[href^='http']")
      .toArray()
      .map((anchor) => absoluteUrl(BASE_URL, $(anchor).attr("href")))
      .find((url) => url && !url.includes("visionias.in"));

    if (!externalLink) return;

    const summary = removeMetadata(fullText, title);
    if (summary.length < 80) return;

    const category = guessCategory(`${title} ${summary}`);
    topics.push({
      source: "Vision IAS",
      title,
      summary: summary.slice(0, 28000),
      url: externalLink,
      publishedAt: extractDate(fullText),
      category,
      paper: guessPaper(category),
      keywords: [],
      imageUrl: null,
    });
  });

  return uniqueByUrl(topics).slice(0, MAX_TOPICS);
}

export async function fetchVisionTopics() {
  // Vision can respond slowly to Vercel IPs; one longer bounded request is
  // preferable to silently reporting zero topics after the shared 20s limit.
  const html = await fetchHtml(LIST_URL, 40000);
  const $ = loadHtml(html);
  return collectTopics($);
}
