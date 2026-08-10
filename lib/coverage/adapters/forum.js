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
import { assessDocumentCandidate } from "@/lib/editorial/publicationSafety";
import { cleanTrustedCoverageText } from "@/lib/coverage/contentCleaner";

const BASE_URL = "https://forumias.com";
const LIST_URL = `${BASE_URL}/blog/9pm/`;
const DIGEST_PATTERN = /forumias\.com\/blog\/9-pm-upsc-current-affairs-articles-\d{1,2}-[a-z]+-20\d{2}/i;

function recentDigestLinks(html) {
  const $ = loadHtml(html);
  const links = [];
  $("a[href]").each((_, anchor) => {
    const url = absoluteUrl(BASE_URL, $(anchor).attr("href"));
    if (url && DIGEST_PATTERN.test(url)) links.push({ url: url.split("#")[0] });
  });
  return uniqueByUrl(links).slice(0, 7);
}

function contentRoot($) {
  for (const selector of [".entry-content", ".post-content", ".td-post-content", "article", "main"]) {
    const node = $(selector).first();
    if (node.length && cleanText(node.text()).length > 500) return node;
  }
  return $("body");
}

function rejected(title = "") {
  const value = cleanText(title);
  return value.length < 10 || value.length > 190 ||
    /^(?:introduction|conclusion|context|background|way forward|for your information|why in news|source|about 9pm|9 pm upsc)/i.test(value) ||
    /\b(?:test series|course|batch|admission|enrol|subscribe|download pdf|quiz|mcq)\b/i.test(value) ||
    !assessDocumentCandidate({ title: value }, { stream: "coverage" }).allowed;
}

function sectionText($, root, heading) {
  const blocks = root.find("h2,h3,h4,h5,p,ul,ol,table,blockquote").toArray();
  const start = blocks.indexOf(heading);
  const parts = [];
  const seen = new Set();
  for (let i = start + 1; i < blocks.length; i += 1) {
    const node = blocks[i];
    if (node.tagName === "h2") break;
    const text = cleanText($(node).text());
    if (node.tagName?.startsWith("h") && rejected(text)) break;
    if (!text || text.length < 3 || seen.has(text.toLowerCase())) continue;
    if (/\b(?:choose your pack|buy now|test series|course|batch|admission|enrol|subscribe|download pdf|interview guidance)\b/i.test(text)) continue;
    seen.add(text.toLowerCase());
    parts.push(node.tagName?.startsWith("h") ? `### ${text}` : text);
  }
  return cleanTrustedCoverageText(
    parts.join("\n\n").replace(/\n{3,}/g, "\n\n").trim()
  ).slice(0, 28000);
}

function extractDigest(html, pageUrl) {
  const $ = loadHtml(html);
  const root = contentRoot($);
  const publishedAt = parseDate($("meta[property='article:published_time']").attr("content")) ||
    parseDate($("time").first().attr("datetime")) || parseDate($("time").first().text());
  const topics = [];
  root.find("h2").each((_, heading) => {
    const title = cleanText($(heading).text()).replace(/^#+\s*/, "");
    if (rejected(title)) return;
    const summary = sectionText($, root, heading);
    if (summary.length < 120) return;
    const category = guessCategory(`${title} ${summary.slice(0, 1800)}`);
    const fragment = title.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 100);
    topics.push({ source: "ForumIAS", title, summary, url: `${pageUrl}#${fragment}`,
      publishedAt, category, paper: guessPaper(category), keywords: [], imageUrl: null });
  });
  return uniqueByUrl(topics);
}

async function fetchDigest({ url }) {
  try { return extractDigest(await fetchHtml(url), url); }
  catch (error) {
    console.error(`[ForumIAS adapter] ${url} failed:`, error?.message || error);
    return [];
  }
}

export async function fetchForumTopics() {
  const links = recentDigestLinks(await fetchHtml(LIST_URL));
  if (!links.length) throw new Error("ForumIAS 9 PM listing contained no recent digest links.");
  const topics = uniqueByUrl((await Promise.all(links.map(fetchDigest))).flat()).slice(0, 300);
  if (!topics.length) throw new Error("ForumIAS recent 9 PM digests contained no usable topic sections.");
  return topics;
}
