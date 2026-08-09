import {
  cleanText,
  guessCategory,
  guessPaper,
  loadHtml,
  parseDate,
  uniqueByUrl,
} from "@/lib/coverage/utils";

const BASE_URL = "https://vajiramandravi.com";

const BROWSER_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "accept-language": "en-IN,en;q=0.9",
  "cache-control": "no-cache",
  pragma: "no-cache",
};

function buildRecentUrls(days = 4) {
  const urls = [];
  const now = new Date();
  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date(now);
    date.setUTCDate(now.getUTCDate() - offset);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    urls.push(`${BASE_URL}/current-affairs/upsc-prelims-current-affairs/${year}/${month}/${day}/`);
    urls.push(`${BASE_URL}/current-affairs/upsc-mains-current-affairs/${year}/${month}/${day}/`);
  }
  return urls;
}

async function fetchBrowserHtml(url, timeoutMs = 20000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { ...BROWSER_HEADERS, referer: `${BASE_URL}/current-affairs/` },
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} while fetching ${url}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function parseDateFromUrl(url) {
  const match = String(url).match(/\/(20\d{2})\/(\d{2})\/(\d{2})\/?$/);
  if (!match) return null;
  return parseDate(`${match[1]}-${match[2]}-${match[3]}T06:00:00+05:30`);
}

function findContentRoot($) {
  for (const selector of [".entry-content", ".post-content", ".article-content", "article", "main"]) {
    const node = $(selector).first();
    if (node.length && cleanText(node.text()).length > 500) return node;
  }
  return $("body");
}

function isRejected(title = "") {
  const value = cleanText(title);
  return (
    value.length < 8 ||
    value.length > 190 ||
    /\bFAQs?$/i.test(value) ||
    /^(?:archives by date|recent post|upsc exam|upsc courses|upsc notes|about upsc|install app)$/i.test(value) ||
    /^current affairs 20\d{2}/i.test(value)
  );
}

function collectSectionText($, root, heading) {
  const blocks = root.find("h2,h3,h4,h5,p,ul,ol,table,blockquote").toArray();
  const start = blocks.indexOf(heading);
  if (start < 0) return "";
  const parts = [];
  const seen = new Set();

  for (let index = start + 1; index < blocks.length; index += 1) {
    const node = blocks[index];
    if (node.tagName === "h2") break;
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
    parts.push(node.tagName?.startsWith("h") ? `### ${text}` : text);
  }

  return parts.join("\n\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 28000);
}

function extractTopics(html, pageUrl) {
  const $ = loadHtml(html);
  const root = findContentRoot($);
  const publishedAt =
    parseDate($("meta[property='article:published_time']").attr("content")) ||
    parseDate($("time").first().attr("datetime")) ||
    parseDateFromUrl(pageUrl);
  const topics = [];

  root.find("h2").each((_, heading) => {
    const title = cleanText($(heading).text());
    if (isRejected(title)) return;
    const summary = collectSectionText($, root, heading);
    if (summary.length < 120) return;

    const category = guessCategory(`${title} ${summary.slice(0, 1800)}`);
    const slug = title
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 100);

    topics.push({
      source: "Vajiram & Ravi",
      title,
      summary,
      url: `${pageUrl.split("#")[0]}#${slug}`,
      publishedAt,
      category,
      paper: guessPaper(category),
      keywords: [],
      imageUrl: null,
    });
  });

  return uniqueByUrl(topics);
}

async function fetchPage(url) {
  try {
    return extractTopics(await fetchBrowserHtml(url), url);
  } catch (error) {
    const message = error?.message || "";
    if (/HTTP 404/i.test(message)) return [];
    console.error(`[Vajiram adapter] ${url} failed:`, message || error);
    return [];
  }
}

export async function fetchVajiramTopics() {
  // Use predictable public daily URLs instead of relying on the landing page.
  // The landing page was returning HTTP 403 from Vercel while the public daily
  // Prelims/Mains pages remained the canonical source pages.
  const urls = buildRecentUrls(4);
  const pages = await Promise.all(urls.map(fetchPage));
  const topics = uniqueByUrl(pages.flat()).slice(0, 240);
  if (!topics.length) {
    throw new Error("Vajiram & Ravi recent Prelims/Mains pages could not be read from the deployment environment.");
  }
  return topics;
}
