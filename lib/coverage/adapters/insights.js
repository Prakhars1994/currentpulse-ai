import {
  cleanText,
  fetchHtml,
  guessCategory,
  guessPaper,
  loadHtml,
  parseDate,
  uniqueByUrl,
} from "@/lib/coverage/utils";

const BASE_URL = "https://www.insightsonindia.com";
const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

const REJECT_TITLE_PATTERNS = [
  /^gs paper\s*\d+/i,
  /^content for mains enrichment/i,
  /^prelims in focus/i,
  /^mapping$/i,
  /^contents?$/i,
  /^current affairs quiz/i,
  /^about/i,
  /^faq/i,
];

function buildRecentUrls(days = 5) {
  const urls = [];
  const now = new Date();
  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date(now);
    date.setUTCDate(now.getUTCDate() - offset);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    const slugMonth = MONTHS[date.getUTCMonth()];
    urls.push(
      `${BASE_URL}/${year}/${month}/${day}/upsc-current-affairs-${date.getUTCDate()}-${slugMonth}-${year}/`
    );
  }
  return urls;
}

function publishedAtFromPage($, fallbackUrl) {
  const meta =
    cleanText($("meta[property='article:published_time']").attr("content")) ||
    cleanText($("time").first().attr("datetime")) ||
    cleanText($("time").first().text());
  if (meta) return parseDate(meta);

  const match = String(fallbackUrl).match(/\/(20\d{2})\/(\d{2})\/(\d{2})\//);
  if (!match) return null;
  return parseDate(`${match[1]}-${match[2]}-${match[3]}T06:00:00+05:30`);
}

function isRejectedTitle(title = "") {
  const value = cleanText(title).replace(/^#+\s*/, "");
  return (
    value.length < 8 ||
    value.length > 190 ||
    REJECT_TITLE_PATTERNS.some((pattern) => pattern.test(value)) ||
    /(?:previous|next)\s+upsc current affairs/i.test(value)
  );
}

function findContentRoot($) {
  const candidates = [
    ".entry-content",
    ".td-post-content",
    ".post-content",
    "article",
    "main",
  ];
  for (const selector of candidates) {
    const node = $(selector).first();
    if (node.length && cleanText(node.text()).length > 500) return node;
  }
  return $("body");
}

function collectSectionText($, root, heading) {
  const blocks = root
    .find("h2,h3,h4,h5,p,ul,ol,table,blockquote")
    .toArray();
  const start = blocks.indexOf(heading);
  if (start < 0) return "";

  const parts = [];
  const seen = new Set();
  for (let index = start + 1; index < blocks.length; index += 1) {
    const node = blocks[index];
    if (node.tagName === "h2") break;

    // Skip nested elements when a parent block is already represented.
    const hasSelectedParent = $(node)
      .parents("p,ul,ol,table,blockquote")
      .toArray()
      .some((parent) => blocks.includes(parent));
    if (hasSelectedParent) continue;

    const text = cleanText($(node).text());
    if (!text || text.length < 3) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    if (/^source\s*:/i.test(text)) {
      parts.push(text);
      continue;
    }
    parts.push(node.tagName?.startsWith("h") ? `### ${text}` : text);
  }

  return parts.join("\n\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 28000);
}

function extractTopicsFromPage(html, pageUrl) {
  const $ = loadHtml(html);
  const root = findContentRoot($);
  const publishedAt = publishedAtFromPage($, pageUrl);
  const topics = [];

  root.find("h2").each((_, heading) => {
    const title = cleanText($(heading).text()).replace(/^#+\s*/, "");
    if (isRejectedTitle(title)) return;

    const summary = collectSectionText($, root, heading);
    if (summary.length < 120) return;

    const category = guessCategory(`${title} ${summary.slice(0, 1800)}`);
    const fragment = title
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 100);

    topics.push({
      source: "Insights IAS",
      title,
      summary,
      url: `${pageUrl.split("#")[0]}#${fragment}`,
      publishedAt,
      category,
      paper: guessPaper(category),
      keywords: [],
      imageUrl: null,
    });
  });

  return uniqueByUrl(topics);
}

async function fetchOne(url) {
  try {
    return extractTopicsFromPage(await fetchHtml(url), url);
  } catch (error) {
    const message = error?.message || "";
    if (/HTTP 404|HTTP 403|HTTP 429/i.test(message)) return [];
    console.error(`[Insights adapter] ${url} failed:`, message || error);
    return [];
  }
}

export async function fetchInsightsTopics() {
  const pageUrls = buildRecentUrls(5);
  const settled = await Promise.all(pageUrls.map(fetchOne));
  const topics = uniqueByUrl(settled.flat()).slice(0, 220);
  if (!topics.length) {
    throw new Error("Insights IAS recent daily current-affairs pages contained no usable topics.");
  }
  return topics;
}
