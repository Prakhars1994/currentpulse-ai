import {
  absoluteUrl,
  cleanText,
  fetchHtml,
  guessCategory,
  guessPaper,
  extractStructuredText,
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

function collectSectionText($, heading, boundarySelector = "h1, h2") {
  const parts = [];
  let node = $(heading).next();

  while (node.length && !node.is(boundarySelector)) {
    const clone = node.clone();
    clone.find("script, style, nav, footer, form, button, iframe, noscript").remove();
    clone.find("h3, h4, h5").each((_, subheading) => {
      const element = $(subheading);
      element.replaceWith(`\n\n### ${cleanText(element.text())}\n\n`);
    });
    clone.find("li").each((_, item) => {
      const element = $(item);
      element.replaceWith(`\n- ${cleanText(element.text())}`);
    });
    clone.find("p, blockquote").each((_, paragraph) => {
      const element = $(paragraph);
      element.replaceWith(`\n\n${cleanText(element.text())}\n\n`);
    });

    const text = String(clone.text() || "")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    if (text) parts.push(text);
    node = node.next();
  }

  return parts.join("\n\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 26000);
}

function extractTopics(html, config, pageUrl) {
  const $ = loadHtml(html);
  const publishedAt = pageDate($);
  const fallbackImage = absoluteUrl(
    config.baseUrl,
    $("meta[property='og:image']").attr("content")
  );
  const topics = [];

  $(config.topicSelector || "main h2, article h2, .entry-content h2, .post-content h2")
    .each((_, heading) => {
      const title = cleanText($(heading).text()).replace(/^#+\s*/, "");
      if (isRejectedHeading(title)) return;

      const summary = collectSectionText($, heading, config.boundarySelector || "h1, h2");
      if (summary.length < 120) return;

      const linkedUrl = absoluteUrl(
        config.baseUrl,
        $(heading).find("a[href]").first().attr("href") ||
          $(heading)
            .nextUntil(config.boundarySelector || "h1, h2")
            .find("a[href]")
            .filter((_, anchor) => /read more|continue/i.test(cleanText($(anchor).text())))
            .first()
            .attr("href")
      );

      const detailUrl =
        config.followTopicLinks &&
        linkedUrl &&
        new URL(linkedUrl).hostname === new URL(config.baseUrl).hostname
          ? linkedUrl
          : "";

      const localImage = absoluteUrl(
        config.baseUrl,
        $(heading).nextUntil("h1, h2, h3").find("img").first().attr("src")
      );
      const category = guessCategory(`${title} ${summary.slice(0, 1600)}`);

      topics.push({
        source: config.sourceName,
        title,
        summary,
        url: detailUrl || `${pageUrl.split("#")[0]}#${slugify(title)}`,
        detailUrl,
        publishedAt,
        category,
        paper: guessPaper(category),
        keywords: [],
        imageUrl: isUsefulArticleImage(localImage || fallbackImage)
          ? localImage || fallbackImage
          : null,
      });
    });

  // This is a per-digest safety ceiling, not a publication quota. It is high
  // enough to preserve all normal daily CA items while protecting the crawler
  // from malformed pages that expose navigation headings as articles.
  return uniqueByUrl(topics).slice(0, config.maxTopicsPerDigest || 60);
}

async function enrichTopic(topic, config) {
  if (!topic.detailUrl) return topic;

  try {
    const html = await fetchHtml(topic.detailUrl);
    const $ = loadHtml(html);
    const title = cleanText($("h1").first().text()) || topic.title;
    const summary = extractStructuredText(
      $,
      config.detailSelectors || [
        "[itemprop='articleBody']",
        ".article-content",
        ".entry-content",
        ".post-content",
        "main article",
        "article",
        "main",
      ]
    ).slice(0, 28000);

    if (summary.length < 400) return topic;

    const category = guessCategory(`${title} ${summary.slice(0, 1800)}`);
    const image = absoluteUrl(
      config.baseUrl,
      $("meta[property='og:image']").attr("content") || $("article img").first().attr("src")
    );

    return {
      ...topic,
      title,
      summary,
      category,
      paper: guessPaper(category),
      imageUrl: isUsefulArticleImage(image) ? image : topic.imageUrl,
      publishedAt: pageDate($) || topic.publishedAt,
    };
  } catch (error) {
    console.error(
      `[Coverage adapter] Detail fetch failed for ${topic.detailUrl}:`,
      error?.message || error
    );
    return topic;
  }
}

async function mapWithConcurrency(items, concurrency, handler) {
  if (!items.length) return [];
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

function findDigestUrls(html, config) {
  const $ = loadHtml(html);
  const candidates = [];

  $("a[href]").each((_, anchor) => {
    const url = absoluteUrl(config.baseUrl, $(anchor).attr("href"));
    const title = cleanText($(anchor).text());
    if (!url || !config.linkPattern.test(url)) return;
    if (config.rejectLinkPattern?.test(url)) return;
    candidates.push({ url, title });
  });

  const unique = uniqueByUrl(candidates);
  const selected = [];
  const seen = new Set();
  const maxDigestPages = Math.max(1, config.maxDigestPages || 3);

  // Some coaching sites (notably Vajiram) publish Prelims and Mains as
  // separate daily streams. Select recent pages from each stream instead of
  // allowing the first stream in the DOM to crowd out the other one.
  if (Array.isArray(config.digestGroups) && config.digestGroups.length) {
    for (const group of config.digestGroups) {
      let taken = 0;
      const groupLimit = Math.max(1, group.limit || 2);
      for (const candidate of unique) {
        if (taken >= groupLimit) break;
        if (seen.has(candidate.url)) continue;
        const matches =
          group.pattern?.test(candidate.url) || group.pattern?.test(candidate.title || "");
        if (!matches) continue;
        selected.push(candidate);
        seen.add(candidate.url);
        taken += 1;
      }
    }
  }

  for (const candidate of unique) {
    if (selected.length >= maxDigestPages) break;
    if (seen.has(candidate.url)) continue;
    selected.push(candidate);
    seen.add(candidate.url);
  }

  return selected.slice(0, maxDigestPages).map((candidate) => candidate.url);
}

export async function fetchDailyDigestTopics(config) {
  const pageUrls = Array.isArray(config.pageUrls) && config.pageUrls.length
    ? config.pageUrls
    : findDigestUrls(await fetchHtml(config.listUrl), config);

  if (!pageUrls.length) {
    throw new Error(`${config.sourceName} recent daily digest links were not found.`);
  }

  const pageResults = await mapWithConcurrency(
    pageUrls,
    Math.min(3, pageUrls.length),
    async (pageUrl) => {
      try {
        return extractTopics(await fetchHtml(pageUrl), config, pageUrl);
      } catch (error) {
        console.error(
          `[Coverage adapter] Digest fetch failed for ${pageUrl}:`,
          error?.message || error
        );
        return [];
      }
    }
  );

  const extracted = uniqueByUrl(pageResults.flat());
  const maxDetailTopics = Math.max(
    0,
    Number.isFinite(Number(config.maxDetailTopics))
      ? Number(config.maxDetailTopics)
      : 24
  );
  const detailCandidates = extracted.slice(0, maxDetailTopics);
  const retainedDigestTopics = extracted.slice(maxDetailTopics);
  const enriched = await mapWithConcurrency(
    detailCandidates,
    config.detailConcurrency || 6,
    (topic) => enrichTopic(topic, config)
  );

  const topics = uniqueByUrl(
    [...enriched, ...retainedDigestTopics].filter(
      (topic) => topic?.title && topic?.summary?.length >= 120
    )
  ).slice(0, config.maxTopicsTotal || 180);

  if (!topics.length) {
    throw new Error(`${config.sourceName} recent digests contained no usable topics.`);
  }

  return topics;
}
