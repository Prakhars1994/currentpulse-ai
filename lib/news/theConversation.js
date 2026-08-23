import * as cheerio from "cheerio";
import { createHash } from "node:crypto";
import { classifyNewsCategory } from "../contentTaxonomy.js";
import { NEWS_SOURCES } from "./sourceCatalog.js";
import { fetchSourceRss } from "./rss.js";

const SOURCE_ID = "the-conversation";
const SOURCE_NAME = "The Conversation";
const MAX_ARTICLE_HTML = 120_000;

export const CONVERSATION_REVIEW_FEEDS = [
  { id: "all-en", label: "All English", url: "https://theconversation.com/articles.atom?language=en" },
  { id: "us", label: "United States", url: "https://theconversation.com/us/articles.atom" },
  { id: "uk", label: "United Kingdom", url: "https://theconversation.com/uk/articles.atom" },
  { id: "au", label: "Australia & New Zealand", url: "https://theconversation.com/au/articles.atom" },
  { id: "ca", label: "Canada", url: "https://theconversation.com/ca/articles.atom" },
  { id: "africa", label: "Africa", url: "https://theconversation.com/africa/articles.atom" },
];

const REVIEW_FEED_CONCURRENCY = 3;

function clean(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function sha256(value = "") {
  return createHash("sha256").update(String(value || "")).digest("hex");
}

function unique(values = []) {
  return [...new Set(values.map((value) => clean(value)).filter(Boolean))];
}

function sourceConfig() {
  const source = NEWS_SOURCES.find((item) => item.id === SOURCE_ID);
  if (!source) throw new Error("The Conversation News source is not configured.");
  return source;
}

function indiaDateKey(value = new Date()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter((part) => ["year", "month", "day"].includes(part.type))
      .map((part) => [part.type, part.value])
  );

  return values.year && values.month && values.day
    ? `${values.year}-${values.month}-${values.day}`
    : "";
}

export function isConversationReviewDay(publishedAt, now = new Date()) {
  const reviewDay = indiaDateKey(now);
  const sourceDay = indiaDateKey(publishedAt);
  return Boolean(reviewDay && sourceDay && reviewDay === sourceDay);
}

export function isTheConversationUrl(value = "") {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    return (
      url.protocol === "https:" &&
      host === "theconversation.com" &&
      /-\d+(?:\/)?$/.test(url.pathname)
    );
  } catch {
    return false;
  }
}

export function conversationArticleId(value = "") {
  if (!isTheConversationUrl(value)) return "";
  const url = new URL(value);
  return url.pathname.match(/-(\d+)(?:\/)?$/)?.[1] || "";
}

async function fetchHtml(url, timeoutMs = 20_000) {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; CurrentPulseAI/1.0; +https://cp.vliab.workers.dev)",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-IN,en;q=0.9",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`The Conversation returned HTTP ${response.status}.`);
  }

  return response.text();
}

function absoluteConversationUrl(value, baseUrl) {
  try {
    const url = new URL(value, baseUrl);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    return url.toString();
  } catch {
    return "";
  }
}

const ALLOWED_TAGS = new Set([
  "p",
  "h2",
  "h3",
  "h4",
  "ul",
  "ol",
  "li",
  "strong",
  "b",
  "em",
  "i",
  "blockquote",
  "a",
  "hr",
  "br",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "img",
]);

export function sanitizeConversationRepublishHtml(html, baseUrl) {
  const $ = cheerio.load(`<div id="cp-conversation-root">${html}</div>`);
  const root = $("#cp-conversation-root");

  root
    .find("script,style,iframe,form,button,input,textarea,select,option")
    .remove();

  root.find("img").each((_, element) => {
    const image = $(element);
    const src = absoluteConversationUrl(image.attr("src"), baseUrl);

    let allowedCounter = false;

    try {
      const parsed = new URL(src);
      allowedCounter =
        parsed.hostname === "counter.theconversation.com" &&
        /\/content\/\d+\/count\.gif$/i.test(parsed.pathname);
    } catch {
      allowedCounter = false;
    }

    // Ordinary article images are omitted: their reuse rights can differ.
    // The mandatory 1x1 The Conversation counter is retained.
    if (!allowedCounter) {
      image.remove();
      return;
    }

    for (const attribute of Object.keys(image.attr() || {})) {
      image.removeAttr(attribute);
    }

    image.attr("src", src);
    image.attr("alt", "The Conversation");
    image.attr("width", "1");
    image.attr("height", "1");
    image.attr("referrerpolicy", "no-referrer-when-downgrade");
  });

  root.find("a").each((_, element) => {
    const link = $(element);
    const href = absoluteConversationUrl(link.attr("href"), baseUrl);

    for (const attribute of Object.keys(link.attr() || {})) {
      link.removeAttr(attribute);
    }

    if (href) {
      link.attr("href", href);
      link.attr("target", "_blank");
      link.attr("rel", "noopener noreferrer");
    }
  });

  root.find("*").each((_, element) => {
    const node = $(element);
    const name = String(element.tagName || element.name || "").toLowerCase();

    if (!name || name === "div") return;

    if (ALLOWED_TAGS.has(name)) {
      if (!["a", "img"].includes(name)) {
        for (const attribute of Object.keys(node.attr() || {})) {
          node.removeAttr(attribute);
        }
      }
      return;
    }

    node.replaceWith(node.contents());
  });

  const output = String(root.html() || "").trim();

  if (output.length > MAX_ARTICLE_HTML) {
    throw new Error(
      "The official republish HTML exceeded the safe storage limit; article was not truncated."
    );
  }

  return output;
}

function officialRepublishCandidate(shareHtml = "") {
  const $ = cheerio.load(shareHtml);

  const candidates = $("textarea")
    .map((_, element) => $(element).text())
    .get()
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  return (
    candidates.find(
      (value) =>
        value.includes("counter.theconversation.com") &&
        /The Conversation/i.test(value) &&
        /original article/i.test(value)
    ) || ""
  );
}


function republishUrlsFromPage(page, canonical) {
  const candidates = new Set();

  const addCandidate = (value) => {
    const cleaned = String(value || "").trim();
    if (!cleaned || !/republish/i.test(cleaned)) return;
    const absolute = absoluteConversationUrl(cleaned, canonical);
    if (absolute && absolute.startsWith("https://theconversation.com/")) {
      candidates.add(absolute);
    }
  };

  page("a[href], form[action]").each((_, element) => {
    const node = page(element);
    addCandidate(node.attr("href"));
    addCandidate(node.attr("action"));
  });

  page("*").each((_, element) => {
    const attributes = element.attribs || {};
    for (const [name, value] of Object.entries(attributes)) {
      if (/republish/i.test(name) || /republish/i.test(String(value || ""))) {
        addCandidate(value);
      }
    }
  });

  return [...candidates].slice(0, 8);
}

function linkedCredits(page, selector) {
  return page(selector)
    .map((_, element) => {
      const node = page(element);
      const name = clean(node.text());
      const href = absoluteConversationUrl(node.attr("href"), "https://theconversation.com");
      return name && href ? { name, href } : null;
    })
    .get()
    .filter(Boolean)
    .filter(
      (item, index, items) =>
        items.findIndex(
          (candidate) =>
            candidate.name === item.name && candidate.href === item.href
        ) === index
    )
    .slice(0, 8);
}

function escapeHtml(value = "") {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildConversationPageFallback(
  pageHtml,
  canonical,
  articleId
) {
  const page = cheerio.load(pageHtml);
  const authors = linkedCredits(
    page,
    'a[href*="/profiles/"]'
  );
  const institutions = linkedCredits(
    page,
    'a[href*="/institutions/"]'
  );

  if (!authors.length || !institutions.length) {
    throw new Error(
      "The Conversation article page did not expose verifiable author and institution credits."
    );
  }

  const selectors = [
    '[itemprop="articleBody"]',
    "[data-article-body]",
    ".content-body",
    ".article-body",
    "article .content",
    "article",
  ];

  let articleHtml = "";

  for (const selector of selectors) {
    const candidate = page(selector).first();
    if (!candidate.length) continue;

    const wrapper = cheerio.load(
      `<div id="cp-source-body">${candidate.html() || ""}</div>`
    );
    wrapper(
      "script,style,noscript,nav,aside,header,footer,form,button,input,textarea,select,option,figure,picture,video,audio"
    ).remove();

    const candidateHtml = String(wrapper("#cp-source-body").html() || "").trim();
    const candidateText = clean(wrapper("#cp-source-body").text());

    if (candidateText.length >= 700) {
      articleHtml = candidateHtml;
      break;
    }
  }

  if (!articleHtml) {
    throw new Error(
      "The Conversation article body could not be extracted safely from the current page."
    );
  }

  const authorCredit = authors
    .map(
      (item) =>
        `<a href="${escapeHtml(item.href)}">${escapeHtml(item.name)}</a>`
    )
    .join(", ");

  const institutionCredit = institutions
    .map(
      (item) =>
        `<a href="${escapeHtml(item.href)}">${escapeHtml(item.name)}</a>`
    )
    .join(", ");

  const counter =
    `<!-- Below is The Conversation's page counter tag. Please DO NOT REMOVE. -->` +
    `<img src="https://counter.theconversation.com/content/${articleId}/count.gif?distributor=republish-lightbox-basic" ` +
    `alt="The Conversation" width="1" height="1" referrerpolicy="no-referrer-when-downgrade">`;

  return [
    `<p><strong>${authorCredit}</strong>, ${institutionCredit}</p>`,
    articleHtml,
    counter,
    `<p><em>This article is republished from <a href="https://theconversation.com">The Conversation</a> under a Creative Commons license. Read the <a href="${escapeHtml(canonical)}">original article</a>.</em></p>`,
  ].join("\\n");
}

async function locateOfficialRepublishHtml(pageHtml, canonical) {
  const inline = officialRepublishCandidate(pageHtml);
  if (inline) return inline;

  const page = cheerio.load(pageHtml);
  const candidates = republishUrlsFromPage(page, canonical);

  for (const candidate of candidates) {
    try {
      const shareHtml = await fetchHtml(candidate);
      const official = officialRepublishCandidate(shareHtml);
      if (official) return official;
    } catch {
      // Keep looking. Current Conversation markup varies by regional edition.
    }
  }

  return "";
}

function extractedCredits(html = "") {
  const $ = cheerio.load(html);

  const authors = unique(
    $('a[href*="/profiles/"]')
      .map((_, element) => $(element).text())
      .get()
  ).slice(0, 8);

  const institutions = unique(
    $('a[href*="/institutions/"]')
      .map((_, element) => $(element).text())
      .get()
  ).slice(0, 8);

  return { authors, institutions };
}

async function mapWithConcurrency(items, concurrency, handler) {
  const output = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      output[index] = await handler(items[index], index);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(Math.max(1, concurrency), items.length) },
      () => worker()
    )
  );

  return output;
}

async function loadConversationEditionFeeds() {
  const base = sourceConfig();

  return mapWithConcurrency(
    CONVERSATION_REVIEW_FEEDS,
    REVIEW_FEED_CONCURRENCY,
    async (feed) => {
      const source = {
        ...base,
        id: `${SOURCE_ID}-${feed.id}`,
        name: `${SOURCE_NAME} · ${feed.label}`,
        rssUrl: feed.url,
      };

      const result = await fetchSourceRss(source, [], {});

      return {
        id: feed.id,
        label: feed.label,
        articles: result.articles || [],
        errors: result.errors || [],
      };
    }
  );
}

function inReviewWindow(publishedAt, windowStart, windowEnd) {
  const timestamp = new Date(publishedAt || 0).getTime();
  const start = new Date(windowStart || 0).getTime();
  const end = new Date(windowEnd || 0).getTime();

  return (
    Number.isFinite(timestamp) &&
    Number.isFinite(start) &&
    Number.isFinite(end) &&
    timestamp >= start &&
    timestamp < end
  );
}

export async function loadTheConversationReviewWindow({
  windowStart,
  windowEnd,
  limit = 240,
} = {}) {
  const safeLimit = Math.max(1, Math.min(300, Number(limit) || 240));
  const feedResults = await loadConversationEditionFeeds();
  const seen = new Set();

  const merged = feedResults
    .flatMap((feed) =>
      feed.articles.map((article) => ({
        ...article,
        edition: feed.label,
      }))
    )
    .filter(
      (article) =>
        isTheConversationUrl(article.url) &&
        inReviewWindow(article.publishedAt, windowStart, windowEnd)
    )
    .sort(
      (left, right) =>
        new Date(right.publishedAt || 0).getTime() -
        new Date(left.publishedAt || 0).getTime()
    )
    .filter((article) => {
      const key = conversationArticleId(article.url) || article.url;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  return {
    source: SOURCE_NAME,
    windowStart: new Date(windowStart).toISOString(),
    windowEnd: new Date(windowEnd).toISOString(),
    errors: feedResults.flatMap((feed) =>
      feed.errors.map((error) => `${feed.label}: ${error}`)
    ),
    feedSummary: feedResults.map((feed) => ({
      id: feed.id,
      label: feed.label,
      ok: feed.errors.length === 0,
      fetched: feed.articles.length,
      errors: feed.errors,
    })),
    stats: {
      feedsRequested: feedResults.length,
      feedsHealthy: feedResults.filter((feed) => feed.errors.length === 0).length,
      rawFeedItems: feedResults.reduce(
        (sum, feed) => sum + feed.articles.length,
        0
      ),
      uniqueInWindow: merged.length,
    },
    items: merged.slice(0, safeLimit).map((article) => ({
      id: article.id,
      articleId: conversationArticleId(article.url),
      title: article.title,
      description: article.description || "",
      url: article.url,
      author: article.author || "",
      publishedAt: article.publishedAt || null,
      source: SOURCE_NAME,
      edition: article.edition || "",
    })),
  };
}

export async function loadTheConversationReviewFeed({
  limit = 80,
  now = new Date(),
} = {}) {
  const reference = new Date(now);
  const end = new Date(reference.getTime() + 1000);
  const start = new Date(reference.getTime() - 24 * 60 * 60 * 1000);

  const result = await loadTheConversationReviewWindow({
    windowStart: start,
    windowEnd: end,
    limit,
  });

  return {
    ...result,
    reviewDate: indiaDateKey(reference),
    items: result.items.filter((item) =>
      isConversationReviewDay(item.publishedAt, reference)
    ),
  };
}

export async function fetchTheConversationRepublish(url) {
  if (!isTheConversationUrl(url)) {
    throw new Error("Only canonical The Conversation article URLs can be republished.");
  }

  const pageHtml = await fetchHtml(url);
  const page = cheerio.load(pageHtml);

  const canonical =
    absoluteConversationUrl(page('link[rel="canonical"]').attr("href"), url) ||
    url;

  if (!isTheConversationUrl(canonical)) {
    throw new Error("The Conversation article did not expose a valid canonical URL.");
  }

  const articleId = conversationArticleId(canonical);

  if (!articleId) {
    throw new Error("The Conversation article ID could not be resolved.");
  }

  const officialHtml = await locateOfficialRepublishHtml(
    pageHtml,
    canonical
  );
  const republishHtml = officialHtml || buildConversationPageFallback(
    pageHtml,
    canonical,
    articleId
  );

  const sanitizedHtml = sanitizeConversationRepublishHtml(
    republishHtml,
    canonical
  );

  const counterPattern = new RegExp(
    `https://counter\\.theconversation\\.com/content/${articleId}/count\\.gif`,
    "i"
  );

  if (!counterPattern.test(sanitizedHtml)) {
    throw new Error(
      "The mandatory The Conversation page counter was missing after sanitation."
    );
  }

  if (!sanitizedHtml.includes(canonical)) {
    throw new Error(
      "The official original-article attribution link was missing after sanitation."
    );
  }

  const sanitizedCredits = extractedCredits(sanitizedHtml);
  const pageCredits = extractedCredits(pageHtml);
  const authors = sanitizedCredits.authors.length
    ? sanitizedCredits.authors
    : pageCredits.authors;
  const institutions = sanitizedCredits.institutions.length
    ? sanitizedCredits.institutions
    : pageCredits.institutions;

  if (!authors.length || !institutions.length) {
    throw new Error(
      "Author or institution attribution could not be verified; article was not published."
    );
  }

  const title =
    clean(page('meta[property="og:title"]').attr("content")) ||
    clean(page("h1").first().text());

  const description =
    clean(page('meta[name="description"]').attr("content")) ||
    clean(page('meta[property="og:description"]').attr("content"));

  const publishedAt =
    clean(page('meta[property="article:published_time"]').attr("content")) ||
    clean(page("time[datetime]").first().attr("datetime")) ||
    null;

  const plainText = clean(cheerio.load(sanitizedHtml).root().text());

  if (!title || plainText.length < 700) {
    throw new Error(
      "The official republish article body was unexpectedly thin; publication was blocked."
    );
  }

  return {
    articleId,
    canonical,
    title,
    description: description || plainText.slice(0, 300),
    publishedAt,
    html: sanitizedHtml,
    authors,
    institutions,
  };
}

function createSlug(title, articleId) {
  const base = clean(title)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 150);

  return `${base || "the-conversation"}-${articleId}`;
}

export async function publishTheConversationArticle(supabase, url) {
  const republish = await fetchTheConversationRepublish(url);
  const sourceKey = `news:the-conversation:${republish.articleId}`;

  const { data: existingSource, error: existingSourceError } = await supabase
    .from("article_sources")
    .select("article_id")
    .eq("source_key", sourceKey)
    .maybeSingle();

  if (existingSourceError) {
    throw new Error(
      `The Conversation duplicate lookup failed: ${existingSourceError.message}`
    );
  }

  if (existingSource?.article_id) {
    const { data: existingArticle } = await supabase
      .from("articles")
      .select("id,title,slug,status")
      .eq("id", existingSource.article_id)
      .maybeSingle();

    return {
      status: "duplicate",
      articleId: existingSource.article_id,
      title: existingArticle?.title || republish.title,
      slug: existingArticle?.slug || null,
    };
  }

  const category = classifyNewsCategory(
    `${republish.title} ${republish.description}`
  );
  const slug = createSlug(republish.title, republish.articleId);
  const now = new Date().toISOString();
  let createdAt = now;

  if (republish.publishedAt) {
    const parsedPublishedAt = new Date(republish.publishedAt);
    if (Number.isFinite(parsedPublishedAt.getTime())) {
      createdAt = parsedPublishedAt.toISOString();
    }
  }

  const tags = [
    "licensed-republish",
    "the-conversation",
    ...republish.authors.map((name) => `conversation-author:${name}`),
    ...republish.institutions.map(
      (name) => `conversation-institution:${name}`
    ),
  ];

  const { data: article, error: insertError } = await supabase
    .from("articles")
    .insert([
      {
        title: republish.title,
        slug,
        category,
        paper: "Prelims",
        content: republish.html,
        why_news: republish.description,
        syllabus_linkage: "",
        india_relevance: "",
        static_foundation: "",
        data_examples: "",
        prelims: "",
        mains: "",
        answer_framework: "",
        question: "",
        visual_summary: "",
        memory_trick: "",
        image: null,
        image_url: null,
        image_alt: republish.title,
        seo_title: republish.title,
        seo_description: republish.description.slice(0, 155),
        quality_score: 95,
        quality_flags: [
          "licensed_republish_the_conversation",
          "no_ai_rewrite",
          "official_republish_html",
        ],
        quality_version: 4,
        tags,
        status: "published",
        created_at: createdAt,
        updated_at: now,
      },
    ])
    .select("id,title,slug,category")
    .single();

  if (insertError) {
    throw new Error(
      `The Conversation article insert failed: ${insertError.message}`
    );
  }

  const { error: sourceError } = await supabase
    .from("article_sources")
    .insert([
      {
        article_id: article.id,
        event_key: `conversation:${republish.articleId}`,
        source_key: sourceKey,
        source_kind: "news",
        source_name: SOURCE_NAME,
        source_title: republish.title,
        source_url: republish.canonical,
        source_published_at: republish.publishedAt || null,
        content_hash: sha256(republish.html),
        updated_at: now,
      },
    ]);

  if (sourceError) {
    await supabase.from("articles").delete().eq("id", article.id);
    throw new Error(
      `The Conversation source record failed: ${sourceError.message}`
    );
  }

  return {
    status: "published",
    articleId: article.id,
    title: article.title,
    slug: article.slug,
    category: article.category,
  };
}
