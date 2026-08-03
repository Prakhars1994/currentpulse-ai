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
import { isUsefulArticleImage } from "@/lib/coverage/contentCleaner";

const REJECT_HEADINGS = [
  /^contents?$/i,
  /^current affairs$/i,
  /^daily current affairs$/i,
  /^headlines? of the day$/i,
  /^download/i,
  /^read more$/i,
  /^related/i,
  /^previous/i,
  /^next/i,
  /^about/i,
  /^contact/i,
  /^frequently asked/i,
];

function slugify(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}

function isRejectedHeading(title) {
  return (
    title.length < 8 ||
    title.length > 190 ||
    REJECT_HEADINGS.some((pattern) => pattern.test(title))
  );
}

function pageDate($) {
  return (
    parseDate($("meta[property='article:published_time']").attr("content")) ||
    parseDate($("time").first().attr("datetime")) ||
    parseDate($("time").first().text()) ||
    null
  );
}

function collectSectionText($, heading) {
  const parts = [];
  let node = $(heading).next();

  while (node.length && !node.is("h1, h2, h3")) {
    const clone = node.clone();
    clone.find("script, style, nav, footer, form, button, iframe, noscript").remove();
    const text = cleanText(clone.text());
    if (text) parts.push(text);
    node = node.next();
  }

  return cleanText(parts.join(" ")).slice(0, 14000);
}

function extractTopics(html, config, pageUrl) {
  const $ = loadHtml(html);
  const publishedAt = pageDate($);
  const fallbackImage = absoluteUrl(
    config.baseUrl,
    $("meta[property='og:image']").attr("content")
  );
  const topics = [];

  $("main h2, main h3, article h2, article h3, .entry-content h2, .entry-content h3, .post-content h2, .post-content h3")
    .each((_, heading) => {
      const title = cleanText($(heading).text()).replace(/^#+\s*/, "");
      if (isRejectedHeading(title)) return;

      const summary = collectSectionText($, heading);
      if (summary.length < 120) return;

      const localImage = absoluteUrl(
        config.baseUrl,
        $(heading).nextUntil("h1, h2, h3").find("img").first().attr("src")
      );
      const category = guessCategory(`${title} ${summary.slice(0, 1600)}`);

      topics.push({
        source: config.sourceName,
        title,
        summary,
        url: `${pageUrl.split("#")[0]}#${slugify(title)}`,
        publishedAt,
        category,
        paper: guessPaper(category),
        keywords: [],
        imageUrl: isUsefulArticleImage(localImage || fallbackImage)
          ? localImage || fallbackImage
          : null,
      });
    });

  return uniqueByUrl(topics).slice(0, config.maxTopics || 16);
}

function findLatestDigestUrl(html, config) {
  const $ = loadHtml(html);
  const candidates = [];

  $("a[href]").each((_, anchor) => {
    const url = absoluteUrl(config.baseUrl, $(anchor).attr("href"));
    const title = cleanText($(anchor).text());
    if (!url || !config.linkPattern.test(url)) return;
    if (config.rejectLinkPattern?.test(url)) return;
    candidates.push({ url, title });
  });

  return uniqueByUrl(candidates)[0]?.url || "";
}

export async function fetchDailyDigestTopics(config) {
  const listHtml = await fetchHtml(config.listUrl);
  const pageUrl = findLatestDigestUrl(listHtml, config);

  if (!pageUrl) {
    throw new Error(`${config.sourceName} latest daily digest link was not found.`);
  }

  const topics = extractTopics(await fetchHtml(pageUrl), config, pageUrl);

  if (topics.length === 0) {
    throw new Error(`${config.sourceName} daily digest contained no usable topics.`);
  }

  return topics;
}
