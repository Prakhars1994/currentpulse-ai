import * as cheerio from "cheerio";
import { resolveGoogleNewsPublisherUrl } from "@/lib/news/imageExtractor";

const MAX_CONTENT = 22000;
const MIN_CONTENT = 650;
const ARTICLE_SELECTORS = [
  "[itemprop='articleBody']",
  ".article-body",
  ".story-body",
  ".story-content",
  ".article-content",
  ".entry-content",
  ".post-content",
  "main article",
  "article",
];

function clean(value = "") {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function safePublicUrl(value) {
  try {
    const url = new URL(String(value || ""));
    if (!["http:", "https:"].includes(url.protocol)) return null;
    const host = url.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host.endsWith(".local") ||
      host === "0.0.0.0" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      /^(?:10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(host)
    ) return null;
    return url;
  } catch {
    return null;
  }
}

function structuredText($, node) {
  const clone = node.clone();
  clone.find(
    "script, style, nav, footer, form, iframe, noscript, button, svg, .advertisement, .ads, .share, .social-share, .related, .newsletter, .comments"
  ).remove();

  clone.find("h2, h3, h4").each((_, heading) => {
    const element = $(heading);
    const level = heading.tagName === "h2" ? "##" : "###";
    element.replaceWith(`\n\n${level} ${clean(element.text())}\n\n`);
  });
  clone.find("li").each((_, item) => {
    const element = $(item);
    element.replaceWith(`\n- ${clean(element.text())}`);
  });
  clone.find("p, blockquote").each((_, paragraph) => {
    const element = $(paragraph);
    element.replaceWith(`\n\n${clean(element.text())}\n\n`);
  });

  return clean(clone.text()).slice(0, MAX_CONTENT);
}

function jsonLdArticleBody($) {
  for (const script of $("script[type='application/ld+json']").toArray()) {
    try {
      const parsed = JSON.parse($(script).text());
      const values = Array.isArray(parsed) ? parsed : [parsed];
      const flattened = values.flatMap((value) => value?.["@graph"] || value || []);
      const article = flattened.find((value) => value?.articleBody);
      if (clean(article?.articleBody).length >= MIN_CONTENT) {
        return clean(article.articleBody).slice(0, MAX_CONTENT);
      }
    } catch {
      // Ignore malformed publisher metadata and continue with DOM extraction.
    }
  }
  return "";
}

async function fetchArticleHtml(inputUrl) {
  let current = safePublicUrl(inputUrl);
  if (!current) return null;

  for (let redirects = 0; redirects <= 3; redirects += 1) {
    const response = await fetch(current, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CurrentPulseAI/1.0; UPSC educational research)",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-IN,en;q=0.9",
      },
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const next = safePublicUrl(new URL(response.headers.get("location") || "", current).toString());
      if (!next) return null;
      current = next;
      continue;
    }

    if (!response.ok || !/text\/html|application\/xhtml\+xml/i.test(response.headers.get("content-type") || "")) {
      return null;
    }
    return { html: await response.text(), finalUrl: current.toString() };
  }
  return null;
}

export async function enrichNewsSource(sourceItem = {}) {
  if (sourceItem.trustedCoverage) return sourceItem;
  const existing = clean(sourceItem.content || sourceItem.description);
  if (existing.length >= 3500 || !sourceItem.url) return sourceItem;

  try {
    let articleUrl = sourceItem.url;
    try {
      const parsed = new URL(articleUrl);
      if (parsed.hostname === "news.google.com" || parsed.hostname.endsWith(".news.google.com")) {
        articleUrl = await resolveGoogleNewsPublisherUrl(articleUrl, sourceItem.sourceDomain || "");
        if (!articleUrl) return sourceItem;
      }
    } catch {
      return sourceItem;
    }

    const fetched = await fetchArticleHtml(articleUrl);
    if (!fetched) return sourceItem;
    const $ = cheerio.load(fetched.html);
    let content = jsonLdArticleBody($);

    if (!content) {
      for (const selector of ARTICLE_SELECTORS) {
        const node = $(selector).first();
        if (!node.length) continue;
        const candidate = structuredText($, node);
        if (candidate.length >= MIN_CONTENT) {
          content = candidate;
          break;
        }
      }
    }

    if (content.length < MIN_CONTENT) return sourceItem;
    return {
      ...sourceItem,
      content,
      url: fetched.finalUrl || sourceItem.url,
      extraction: "publisher_article_body",
    };
  } catch (error) {
    console.error(`[Source enrichment] ${sourceItem.title || sourceItem.url}:`, error?.message || error);
    return sourceItem;
  }
}
