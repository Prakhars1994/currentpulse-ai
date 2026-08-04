import * as cheerio from "cheerio";
import { classifyCategory, resolvePaper } from "@/lib/contentTaxonomy";

const DEFAULT_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36 CurrentPulseBot/1.0",
  accept: "text/html,application/xhtml+xml",
  "accept-language": "en-IN,en;q=0.9",
};

export function cleanText(value) {
  return typeof value === "string"
    ? value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim()
    : "";
}

export function absoluteUrl(baseUrl, value) {
  const url = cleanText(value);
  if (!url) return "";

  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return "";
  }
}

export function uniqueByUrl(items) {
  const seen = new Set();

  return items.filter((item) => {
    const key = cleanText(item?.url).replace(/\/$/, "").toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function fetchHtml(url, timeoutMs = 20000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: DEFAULT_HEADERS,
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

export function loadHtml(html) {
  return cheerio.load(html || "");
}

export function extractMainText($, selectors) {
  for (const selector of selectors) {
    const node = $(selector).first().clone();
    if (!node.length) continue;

    node
      .find(
        "script, style, nav, footer, form, iframe, noscript, .advertisement, .ads, .share, .social-share"
      )
      .remove();

    const text = cleanText(node.text());
    if (text.length >= 120) return text;
  }

  return cleanText($("body").text());
}

export function extractStructuredText($, selectors) {
  for (const selector of selectors) {
    const node = $(selector).first().clone();
    if (!node.length) continue;

    node
      .find(
        "script, style, nav, footer, form, iframe, noscript, button, svg, .advertisement, .ads, .share, .social-share, .related-posts, .newsletter, .comments"
      )
      .remove();

    node.find("h2, h3, h4, h5").each((_, heading) => {
      const element = $(heading);
      const level = heading.tagName === "h2" ? "##" : "###";
      element.replaceWith(`\n\n${level} ${cleanText(element.text())}\n\n`);
    });
    node.find("li").each((_, item) => {
      const element = $(item);
      element.replaceWith(`\n- ${cleanText(element.text())}`);
    });
    node.find("p, blockquote, table").each((_, block) => {
      const element = $(block);
      element.replaceWith(`\n\n${cleanText(element.text())}\n\n`);
    });

    const text = String(node.text() || "")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    if (text.length >= 120) return text;
  }

  return extractMainText($, selectors);
}

export function parseDate(value) {
  const text = cleanText(value);
  if (!text) return null;

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function guessCategory(text) {
  return classifyCategory(cleanText(text));
}

export function guessPaper(category) {
  return resolvePaper(category);
}
