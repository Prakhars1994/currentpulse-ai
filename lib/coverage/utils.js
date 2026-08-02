import * as cheerio from "cheerio";

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

export function parseDate(value) {
  const text = cleanText(value);
  if (!text) return null;

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function guessCategory(text) {
  const value = cleanText(text).toLowerCase();

  if (/constitution|polity|governance|parliament|judiciary/.test(value)) {
    return "Polity & Governance";
  }
  if (/economy|economic|bank|finance|inflation|gdp|trade/.test(value)) {
    return "Economy";
  }
  if (/international|foreign|diplomacy|global|bilateral/.test(value)) {
    return "International Relations";
  }
  if (/science|technology|space|digital|cyber|biotech/.test(value)) {
    return "Science & Technology";
  }
  if (/environment|ecology|climate|biodiversity|pollution/.test(value)) {
    return "Environment";
  }
  if (/defence|defense|security|military|terror/.test(value)) {
    return "Defence & Security";
  }
  if (/society|social|health|education|women|poverty/.test(value)) {
    return "Social Issues";
  }
  if (/geography|river|ocean|mountain|earthquake/.test(value)) {
    return "Geography";
  }
  if (/history|culture|heritage|archaeology/.test(value)) {
    return "History & Culture";
  }
  if (/scheme|mission|programme|program|yojana/.test(value)) {
    return "Government Schemes";
  }

  return "Polity & Governance";
}

export function guessPaper(category) {
  const map = {
    "History & Culture": "GS-1",
    Geography: "GS-1",
    "Social Issues": "GS-1",
    "Polity & Governance": "GS-2",
    "International Relations": "GS-2",
    Economy: "GS-3",
    "Science & Technology": "GS-3",
    Environment: "GS-3",
    "Defence & Security": "GS-3",
    "Government Schemes": "GS-2",
  };

  return map[category] || "Prelims";
}
