import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GOOGLE_NEWS_HOST = "news.google.com";

function cleanText(value = "") {
  return String(value)
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isValidHttpUrl(value = "") {
  try {
    const url = new URL(value);

    return (
      url.protocol === "http:" ||
      url.protocol === "https:"
    );
  } catch {
    return false;
  }
}

function isGoogleNewsUrl(value = "") {
  try {
    return new URL(value).hostname === GOOGLE_NEWS_HOST;
  } catch {
    return false;
  }
}

function getGoogleArticleId(sourceUrl) {
  const url = new URL(sourceUrl);

  const pathParts = url.pathname
    .split("/")
    .filter(Boolean);

  const articlesIndex = pathParts.findIndex(
    (part) => part === "articles" || part === "read"
  );

  if (
    articlesIndex === -1 ||
    !pathParts[articlesIndex + 1]
  ) {
    throw new Error(
      "Unable to find the Google News article identifier."
    );
  }

  return pathParts[articlesIndex + 1];
}

async function fetchWithTimeout(
  url,
  options = {},
  timeout = 20000
) {
  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeout);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function getDecodingParameters(articleId) {
  const candidateUrls = [
    `https://news.google.com/articles/${articleId}`,
    `https://news.google.com/rss/articles/${articleId}`,
  ];

  let lastError;

  for (const candidateUrl of candidateUrls) {
    try {
      const response = await fetchWithTimeout(candidateUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/137.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-IN,en;q=0.9",
        },
        redirect: "follow",
      });

      if (!response.ok) {
        throw new Error(
          `Google decoding page returned ${response.status}.`
        );
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      const decodingElement =
        $("c-wiz > div[data-n-a-sg][data-n-a-ts]").first();

      const signature = decodingElement.attr("data-n-a-sg");
      const timestamp = decodingElement.attr("data-n-a-ts");

      if (!signature || !timestamp) {
        throw new Error(
          "Google decoding parameters were not found."
        );
      }

      return {
        articleId,
        signature,
        timestamp,
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error(
    "Unable to obtain Google News decoding parameters."
  );
}

async function decodeGoogleNewsUrl(sourceUrl) {
  if (!isGoogleNewsUrl(sourceUrl)) {
    return sourceUrl;
  }

  const articleId = getGoogleArticleId(sourceUrl);

  const {
    signature,
    timestamp,
  } = await getDecodingParameters(articleId);

  const requestPayload = [
    "Fbv4je",
    JSON.stringify([
      "garturlreq",
      [
        [
          "en-IN",
          "IN",
          [
            "FINANCE_TOP_INDICES",
            "WEB_TEST_1_0_0",
          ],
          null,
          null,
          1,
          1,
          "IN:en",
          null,
          180,
          null,
          null,
          null,
          null,
          null,
          0,
          null,
          null,
          [1608992183, 723341000],
        ],
        "en-IN",
        "IN",
        1,
        [2, 3, 4, 8],
        1,
        0,
        "655000234",
        0,
        0,
        null,
        0,
      ],
      articleId,
      Number(timestamp),
      signature,
    ]),
    null,
    "generic",
  ];

  const formBody = new URLSearchParams({
    "f.req": JSON.stringify([[requestPayload]]),
  });

  const response = await fetchWithTimeout(
    "https://news.google.com/_/DotsSplashUi/data/batchexecute?rpcids=Fbv4je",
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded;charset=UTF-8",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/137.0 Safari/537.36",
        Referer: "https://news.google.com/",
        "Accept-Language": "en-IN,en;q=0.9",
      },
      body: formBody.toString(),
    }
  );

  if (!response.ok) {
    throw new Error(
      `Google URL decoder returned ${response.status}.`
    );
  }

  const responseText = await response.text();

  const marker = '[\\"garturlres\\",\\"';
  const markerPosition = responseText.indexOf(marker);

  if (markerPosition === -1) {
    throw new Error(
      "Google did not return the original publisher URL."
    );
  }

  const remainingText = responseText.slice(
    markerPosition + marker.length
  );

  const endingPosition = remainingText.indexOf('\\",');

  if (endingPosition === -1) {
    throw new Error(
      "The decoded publisher URL was incomplete."
    );
  }

  const escapedUrl = remainingText.slice(
    0,
    endingPosition
  );

  const decodedUrl = JSON.parse(`"${escapedUrl}"`);

  if (
    !isValidHttpUrl(decodedUrl) ||
    isGoogleNewsUrl(decodedUrl)
  ) {
    throw new Error(
      "Google returned an invalid publisher URL."
    );
  }

  return decodedUrl;
}

function chooseArticleContainer($) {
  const selectors = [
    "article",
    "[itemprop='articleBody']",
    ".article-body",
    ".articleBody",
    ".story-body",
    ".story-content",
    ".entry-content",
    ".post-content",
    ".main-content",
    "main",
  ];

  let bestText = "";

  for (const selector of selectors) {
    $(selector).each((index, element) => {
      const text = cleanText($(element).text());

      if (text.length > bestText.length) {
        bestText = text;
      }
    });
  }

  return bestText;
}

function extractArticleContent(html, publisherUrl) {
  const $ = cheerio.load(html);

  $(
    [
      "script",
      "style",
      "noscript",
      "iframe",
      "svg",
      "nav",
      "footer",
      "header",
      "aside",
      "form",
      "button",
      ".advertisement",
      ".ads",
      ".ad",
      ".social-share",
      ".related",
      ".recommended",
      ".comments",
      ".newsletter",
      ".cookie",
      ".breadcrumb",
    ].join(",")
  ).remove();

  const title =
    cleanText(
      $("meta[property='og:title']").attr("content")
    ) ||
    cleanText($("h1").first().text()) ||
    cleanText($("title").text());

  const description =
    cleanText(
      $("meta[name='description']").attr("content")
    ) ||
    cleanText(
      $("meta[property='og:description']").attr(
        "content"
      )
    );

  const imageUrl =
    cleanText(
      $("meta[property='og:image']").attr("content")
    ) || "";

  let articleText = chooseArticleContainer($);

  if (articleText.length < 500) {
    const paragraphs = [];

    $("p").each((index, element) => {
      const paragraph = cleanText($(element).text());

      if (paragraph.length >= 40) {
        paragraphs.push(paragraph);
      }
    });

    articleText = paragraphs.join("\n\n");
  }

  articleText = cleanText(articleText);

  if (articleText.length > 20000) {
    articleText = articleText.slice(0, 20000);
  }

  if (articleText.length < 300) {
    throw new Error(
      "The publisher page did not contain enough readable article text."
    );
  }

  return {
    publisherUrl,
    title,
    description,
    imageUrl,
    text: articleText,
  };
}

async function fetchPublisherArticle(publisherUrl) {
  const response = await fetchWithTimeout(
    publisherUrl,
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/137.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-IN,en;q=0.9",
      },
      redirect: "follow",
    },
    25000
  );

  if (!response.ok) {
    throw new Error(
      `Publisher webpage returned ${response.status}.`
    );
  }

  const contentType =
    response.headers.get("content-type") || "";

  if (!contentType.includes("text/html")) {
    throw new Error(
      "The resolved publisher URL did not return an HTML article."
    );
  }

  const html = await response.text();

  return extractArticleContent(
    html,
    response.url || publisherUrl
  );
}

export async function POST(request) {
  try {
    const body = await request.json();
    const sourceUrl = cleanText(body.url);

    if (!sourceUrl || !isValidHttpUrl(sourceUrl)) {
      return NextResponse.json(
        {
          success: false,
          error: "A valid news URL is required.",
        },
        { status: 400 }
      );
    }

    const publisherUrl =
      await decodeGoogleNewsUrl(sourceUrl);

    const article =
      await fetchPublisherArticle(publisherUrl);

    return NextResponse.json({
      success: true,
      sourceUrl,
      publisherUrl,
      article,
    });
  } catch (error) {
    console.error("Resolve news error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error?.name === "AbortError"
            ? "The news website took too long to respond."
            : error?.message ||
              "Failed to resolve the news article.",
      },
      { status: 500 }
    );
  }
}