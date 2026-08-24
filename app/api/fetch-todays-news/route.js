import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { classifyNewsCategory, resolvePaper } from "@/lib/contentTaxonomy";
import { assessNewsCandidate } from "@/lib/editorial/publicationSafety";
import { isCronAuthorized } from "@/lib/cronAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PIB_HOME_URL =
  "https://www.pib.gov.in/indexd.aspx?lang=1&reg=3";
const MAX_COLLECTED_ARTICLES = 25;
const MAX_SELECTED_ARTICLES = 12;
const CONTENT_FETCH_CONCURRENCY = 3;
const MINIMUM_IMPORTANCE = 5;
const MAX_DESCRIPTION_LENGTH = 6000;

const EXCLUDED_TITLE_WORDS = [
  "condoles",
  "condolence",
  "greets",
  "greetings",
  "birthday",
  "congratulates",
  "congratulation",
  "pays tribute",
  "paid floral tribute",
  "courtesy call",
  "calls on",
  "meets delegation",
  "photo release",
  "media invitation",
  "tour programme",
  "recruitment",
  "vacancy",
  "tender",
  "appointment",
  "engineering services examination",
  "direct recruitment",
  "financial results",
  "blood donation camp",
  "press communique",
];

const UPSC_PRIORITY_WORDS = [
  "cabinet",
  "scheme",
  "mission",
  "policy",
  "bill",
  "act",
  "rules",
  "programme",
  "initiative",
  "economy",
  "economic",
  "finance",
  "banking",
  "agriculture",
  "farmer",
  "environment",
  "climate",
  "biodiversity",
  "forest",
  "energy",
  "renewable",
  "science",
  "technology",
  "space",
  "isro",
  "defence",
  "security",
  "international",
  "agreement",
  "trade",
  "infrastructure",
  "railway",
  "health",
  "education",
  "governance",
  "constitution",
  "tribal",
  "women",
  "social justice",
  "disaster",
  "water",
  "digital",
  "artificial intelligence",
  "semiconductor",
  "telecommunication",
  "brics",
  "employment",
  "welfare",
  "transport",
  "urban",
  "rural",
];

function cleanText(value = "") {
  return String(value)
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUrl(value = "") {
  const rawUrl = cleanText(value);

  if (!rawUrl) {
    return "";
  }

  try {
    const url = new URL(rawUrl, PIB_HOME_URL);

    if (
      url.pathname
        .toLowerCase()
        .includes("pressreleasedetail.aspx") ||
      url.pathname
        .toLowerCase()
        .includes("pressreleasepage.aspx") ||
      url.pathname
        .toLowerCase()
        .includes("pressrelesedetailm.aspx")
    ) {


      url.searchParams.set("reg", "3");
      url.searchParams.set("lang", "1");
    }

    return url.toString();
  } catch {
    return "";
  }
}

function normalizeTitle(value = "") {
  return cleanText(value)
    .replace(/\s*\.\.\.$/, "")
    .replace(/\s*…$/, "")
    .trim();
}

function isPressReleaseUrl(url = "") {
  const lowerUrl = url.toLowerCase();

  const isReleasePage =
    lowerUrl.includes("pressreleasedetail.aspx") ||
    lowerUrl.includes("pressreleasepage.aspx") ||
    lowerUrl.includes("pressrelesedetailm.aspx");

  return (
    isReleasePage &&
    lowerUrl.includes("prid=")
  );
}

function isExcludedTitle(title = "") {
  const lowerTitle = title.toLowerCase();

  return EXCLUDED_TITLE_WORDS.some(
    (word) =>
      lowerTitle.includes(word)
  );
}

function getPriorityScore(title = "") {
  const lowerTitle = title.toLowerCase();

  return UPSC_PRIORITY_WORDS.reduce(
    (score, word) => {
      return lowerTitle.includes(word)
        ? score + 1
        : score;
    },
    0
  );
}

function createId(url) {
  const pridMatch =
    url.match(/[?&]PRID=(\d+)/i);

  if (pridMatch?.[1]) {
    return `pib-${pridMatch[1]}`;
  }

  return `pib-${Buffer.from(url)
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 20)}`;
}
function removeDuplicates(items) {
  const seenUrls = new Set();
  const seenTitles = new Set();

  return items.filter((item) => {
    const titleKey = item.title
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

    if (
      seenUrls.has(item.url) ||
      seenTitles.has(titleKey)
    ) {
      return false;
    }

    seenUrls.add(item.url);
    seenTitles.add(titleKey);

    return true;
  });
}

async function fetchWithTimeout(
  url,
  timeout = 20000
) {
  const controller =
    new AbortController();

  const timeoutId = setTimeout(
    () => controller.abort(),
    timeout
  );

  try {
    return await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/137.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language":
          "en-US,en;q=0.9",
      },
      cache: "no-store",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function extractBestTitle(
  $,
  fallbackTitle
) {
  const invalidTitles = [
    "government of india",
    "भारत सरकार",
    "press information bureau",
    "पत्र सूचना कार्यालय",
    "press release",
    "प्रेस विज्ञप्ति",
  ];

  const titleCandidates = [
    $(".pressReleaseTitle")
      .first()
      .text(),

    $(".releaseTitle")
      .first()
      .text(),

    $("#ContentPlaceHolder1_lblTitle")
      .first()
      .text(),

    $("#ContentPlaceHolder1_lblHeading")
      .first()
      .text(),

    $('meta[property="og:title"]')
      .attr("content"),

    $("h1")
      .first()
      .text(),

    $("h2")
      .first()
      .text(),

    fallbackTitle,
  ];

  for (
    const candidate
    of titleCandidates
  ) {
    const title =
      normalizeTitle(candidate);

    if (
      !title ||
      title.length < 15
    ) {
      continue;
    }

    const lowerTitle =
      title.toLowerCase();

    const isGeneric =
      invalidTitles.some(
        (invalidTitle) =>
          lowerTitle === invalidTitle ||
          lowerTitle.startsWith(
            `${invalidTitle} |`
          )
      );

    if (!isGeneric) {
      return title;
    }
  }

  return fallbackTitle;
}

function extractBestContent($) {
  const candidates = [];

  // Best source: PIB stores the full article HTML here
  const encodedDescription = $("#ltrDescriptionn").attr("value");

  if (encodedDescription) {
    const decodedDocument = cheerio.load(encodedDescription);
    const text = cleanText(decodedDocument.root().text());

    if (text.length >= 200) {
      candidates.push(text);
    }
  }

  // Second source: printable article container
  const pdfDiv = $("#PdfDiv");

  if (pdfDiv.length) {
    const clone = pdfDiv.clone();

    clone
      .find(
        [
          "script",
          "style",
          "nav",
          "header",
          "footer",
          "form",
          "input",
          "button",
          "iframe",
          "noscript",
          "img",
          ".footer",
          "#footer",
          ".breadcrumb",
          ".breadcrumbs",
          ".social-share",
          ".share",
          ".visitor-counter",
        ].join(",")
      )
      .remove();

    const text = cleanText(clone.text());

    if (text.length >= 200) {
      candidates.push(text);
    }
  }

  // Existing PIB and general fallback selectors
  const contentSelectors = [
    ".content-area",
    ".contentArea",
    ".innner-page-main-about-us-content-right-part",
    ".innner-page-main-about-us-content-right-part-content",
    ".PressReleaseContent",
    ".pressReleaseContent",
    ".press-release-content",
    ".releaseContent",
    ".release-content",
    "#ContentPlaceHolder1_lblDetails",
    "#ContentPlaceHolder1_divContent",
    "#ContentPlaceHolder1_pnlContent",
    "#divContent",
    "article",
    "main",
  ];

  const badTextPatterns = [
    "site is hosted by national informatics centre",
    "information is provided and updated by press information bureau",
    "visitor counter",
    "last updated on",
    "click here for releases",
    "no release found",
    "all ministry",
  ];

  for (const selector of contentSelectors) {
    $(selector).each((index, element) => {
      const clone = $(element).clone();

      clone
        .find(
          [
            "script",
            "style",
            "nav",
            "header",
            "footer",
            "form",
            "input",
            "button",
            "iframe",
            "noscript",
            "img",
            ".footer",
            "#footer",
            ".breadcrumb",
            ".breadcrumbs",
            ".social-share",
            ".share",
            ".visitor-counter",
          ].join(",")
        )
        .remove();

      const text = cleanText(clone.text());
      const lowerText = text.toLowerCase();

      const containsBadText = badTextPatterns.some((pattern) =>
        lowerText.includes(pattern)
      );

      if (text.length >= 200 && !containsBadText) {
        candidates.push(text);
      }
    });
  }

  // Paragraph fallback
  const paragraphs = [];

  $("p").each((index, element) => {
    const paragraph = $(element);
    const text = cleanText(paragraph.text());
    const lowerText = text.toLowerCase();

    const insideFooterOrNavigation =
      paragraph.closest(
        [
          "footer",
          "nav",
          "header",
          "form",
          ".footer",
          "#footer",
          ".menu",
          ".navbar",
          ".navigation",
          ".breadcrumb",
          ".breadcrumbs",
        ].join(",")
      ).length > 0;

    const containsBadText = badTextPatterns.some((pattern) =>
      lowerText.includes(pattern)
    );

    if (
      !insideFooterOrNavigation &&
      !containsBadText &&
      text.length >= 40
    ) {
      paragraphs.push(text);
    }
  });

  const paragraphText = cleanText(paragraphs.join("\n\n"));

  if (paragraphText.length >= 200) {
    candidates.push(paragraphText);
  }

  if (candidates.length === 0) {
    return "";
  }

  return candidates.sort(
    (first, second) => second.length - first.length
  )[0];
}
function looksLikeNavigationContent(
  title = "",
  description = ""
) {
  const combinedText =
    `${title} ${description}`
      .toLowerCase();

  const navigationIndicators = [
    "all ministry",
    "all ministries",
    "press releases archive",
    "click here for releases",
    "visitor counter",
    "terms & conditions",
    "privacy policy",
    "hyperlinking policy",
    "ministry of agriculture",
    "ministry of defence",
    "ministry of finance",
  ];

  const matches =
    navigationIndicators.filter(
      (indicator) =>
        combinedText.includes(
          indicator
        )
    ).length;

  return matches >= 3;
}

async function fetchPibArticleDetails(
  article
) {
  try {
    const response =
      await fetchWithTimeout(
        article.url,
        20000
      );

    if (!response.ok) {
      throw new Error(
        `PIB article request failed with status ${response.status}.`
      );
    }

    const html =
      await response.text();

    if (!html.trim()) {
      throw new Error(
        "PIB article page returned empty HTML."
      );
    }

    let $ = cheerio.load(html);
const iframeSrc = $("#ContentPlaceHolder1_iframepressrealese").attr("src");

if (iframeSrc) {
  const iframeUrl = new URL(
    iframeSrc,
    article.url
  ).toString();

  const iframeResponse = await fetch(iframeUrl, {
    headers: {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/150 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  Referer: article.url,
},
  });

  if (iframeResponse.ok) {
    const iframeHtml = await iframeResponse.text();

    $ = cheerio.load(iframeHtml);
  }
}

    const fullTitle =
      extractBestTitle(
        $,
        article.title
      );

    let description =
      extractBestContent($);

    if (
      looksLikeNavigationContent(
        fullTitle,
        description
      )
    ) {
      throw new Error(
        "PIB returned a navigation or archive page instead of the press-release content."
      );
    }

    if (
      fullTitle &&
      description
        .toLowerCase()
        .startsWith(
          fullTitle.toLowerCase()
        )
    ) {
      description =
        description
          .slice(
            fullTitle.length
          )
          .trim();
    }

    description =
      description
        .replace(/\s+/g, " ")
        .trim()
        .slice(
          0,
          MAX_DESCRIPTION_LENGTH
        );

    return {
      ...article,

      title:
        fullTitle ||
        article.title,

      description,

      contentFetched:
        description.length > 0,

      contentError:
        description.length > 0
          ? null
          : "PIB page was fetched, but no usable article content was found.",
    };
  } catch (error) {
    console.error(
      `PIB content extraction failed for "${article.title}":`,
      error?.message ||
        error
    );

    return {
      ...article,

      contentFetched: false,

      contentError:
        error?.name ===
        "AbortError"
          ? "PIB article took too long to respond."
          : error?.message ||
            "Failed to extract PIB article content.",
    };
  }
}

async function enrichArticlesWithContent(
  articles,
  concurrency =
    CONTENT_FETCH_CONCURRENCY
) {
  if (
    !Array.isArray(articles) ||
    articles.length === 0
  ) {
    return [];
  }

  const results =
    new Array(articles.length);

  let nextIndex = 0;

  async function worker() {
    while (true) {
      const currentIndex =
        nextIndex;

      nextIndex += 1;

      if (
        currentIndex >=
        articles.length
      ) {
        return;
      }

      results[currentIndex] =
        await fetchPibArticleDetails(
          articles[
            currentIndex
          ]
        );
    }
  }

  const workerCount =
    Math.min(
      concurrency,
      articles.length
    );

  await Promise.all(
    Array.from(
      {
        length:
          workerCount,
      },
      () => worker()
    )
  );

  return results;
}

function extractLatestReleases(
  html
) {
  const $ =
    cheerio.load(html);

  const articles = [];

  $("a[href]").each(
    (index, element) => {
      const anchor =
        $(element);

      const url =
        normalizeUrl(
          anchor.attr("href")
        );

      let title =
        normalizeTitle(
          anchor.text()
        );

      if (
        !isPressReleaseUrl(url)
      ) {
        return;
      }

      if (!title) {
        title =
          normalizeTitle(
            anchor.attr("title") ||
              anchor
                .find("img")
                .attr("alt") ||
              ""
          );
      }

      if (
        title.length < 15 ||
        isExcludedTitle(title)
      ) {
        return;
      }

      articles.push({
        id: createId(url),

        title,

        url,

        source: "PIB",

        description: "",

        priorityScore:
          getPriorityScore(
            title
          ),

        discoveredAt:
          new Date()
            .toISOString(),
      });
    }
  );

  return removeDuplicates(
    articles
  );
}

async function collectLatestPibNews() {
  const response =
    await fetchWithTimeout(
      PIB_HOME_URL
    );

  if (!response.ok) {
    throw new Error(
      `PIB homepage request failed with status ${response.status}.`
    );
  }

  const html =
    await response.text();

  if (!html.trim()) {
    throw new Error(
      "PIB returned an empty webpage."
    );
  }

  const articles =
    extractLatestReleases(
      html
    );

  if (
    articles.length === 0
  ) {
    throw new Error(
      "No PIB press-release links were found on the homepage."
    );
  }

  return articles
    .sort(
      (first, second) => {
        if (
          second
            .priorityScore !==
          first.priorityScore
        ) {
          return (
            second
              .priorityScore -
            first
              .priorityScore
          );
        }

        return first.title
          .localeCompare(
            second.title
          );
      }
    )
    .slice(
      0,
      MAX_COLLECTED_ARTICLES
    );
}

function evaluateSingleArticle(
  article
) {
  const text =
    `${article.title || ""} ${article.description || ""}`;
  const safety =
    assessNewsCandidate({
      ...article,
      source:
        article.source ||
        "PIB",
      region:
        article.region ||
        "IN",
    });
  const priorityScore =
    Math.max(
      Number(article.priorityScore) || 0,
      getPriorityScore(text)
    );
  const category =
    classifyNewsCategory(text);
  const relevant =
    safety.allowed === true;
  const importance =
    relevant
      ? Math.min(
          10,
          MINIMUM_IMPORTANCE +
            Math.min(
              5,
              priorityScore
            )
        )
      : 1;
  const lowerText =
    text.toLowerCase();
  const keywords =
    UPSC_PRIORITY_WORDS
      .filter((word) =>
        lowerText.includes(word)
      )
      .slice(0, 8);

  return {
    ...article,
    priorityScore,
    evaluation: {
      relevant,
      scope: "India",
      importance,
      category,
      paper:
        resolvePaper(category),
      reason:
        relevant
          ? "Official PIB release passed deterministic publication-safety rules; no AI relevance selection applied."
          : safety.reason ||
            "Rejected by deterministic publication-safety rules.",
      keywords,
    },
    evaluatedAt:
      new Date()
        .toISOString(),
    evaluationError: null,
  };
}

function evaluateArticlesDeterministically(
  articles
) {
  if (
    !Array.isArray(articles) ||
    articles.length === 0
  ) {
    return [];
  }

  return articles.map(
    evaluateSingleArticle
  );
}

function isRelevantArticle(
  article
) {
  return (
    article.evaluation
      ?.relevant === true &&
    article.evaluation
      .importance >=
      MINIMUM_IMPORTANCE
  );
}

export async function GET(request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    const collectedArticles =
      await collectLatestPibNews();

    const selectedForEvaluation =
      collectedArticles.slice(
        0,
        MAX_SELECTED_ARTICLES
      );

    const enrichedArticles =
      await enrichArticlesWithContent(
        selectedForEvaluation
      );

    const evaluatedArticles =
      evaluateArticlesDeterministically(
        enrichedArticles
      );

    const relevantArticles =
      evaluatedArticles
        .filter(
          isRelevantArticle
        )
        .sort(
          (
            first,
            second
          ) => {
            const importanceDifference =
              second
                .evaluation
                .importance -
              first
                .evaluation
                .importance;

            if (
              importanceDifference !==
              0
            ) {
              return importanceDifference;
            }

            return (
              second
                .priorityScore -
              first
                .priorityScore
            );
          }
        );

    const rejectedArticles =
      evaluatedArticles.filter(
        (article) =>
          article.evaluation &&
          !isRelevantArticle(
            article
          )
      );

    const failedEvaluations =
      evaluatedArticles.filter(
        (article) =>
          Boolean(
            article
              .evaluationError
          )
      );

    const contentFetched =
      enrichedArticles.filter(
        (article) =>
          article
            .contentFetched ===
          true
      );

    const contentFailed =
      enrichedArticles.filter(
        (article) =>
          article
            .contentFetched !==
          true
      );

    return NextResponse.json({
      success: true,

      source: "PIB",

      sourceUrl:
        PIB_HOME_URL,

      collectedAt:
        new Date()
          .toISOString(),

      settings: {
        maximumCollected:
          MAX_COLLECTED_ARTICLES,

        maximumEvaluated:
          MAX_SELECTED_ARTICLES,

        minimumImportance:
          MINIMUM_IMPORTANCE,

        aiConcurrency:
          0,

        evaluationMode:
          "deterministic",

        contentFetchConcurrency:
          CONTENT_FETCH_CONCURRENCY,

        maximumDescriptionLength:
          MAX_DESCRIPTION_LENGTH,
      },

      counts: {
        collected:
          collectedArticles
            .length,

        selected:
          selectedForEvaluation
            .length,

        contentFetched:
          contentFetched.length,

        contentFailed:
          contentFailed.length,

        evaluated:
          evaluatedArticles
            .length,

        relevant:
          relevantArticles
            .length,

        rejected:
          rejectedArticles
            .length,

        failed:
          failedEvaluations
            .length,
      },

      count:
        relevantArticles.length,

      articles:
        relevantArticles,

      rejectedArticles,

      failedEvaluations,

      contentFailedArticles:
        contentFailed,
    });
  } catch (error) {
    console.error(
      "Today's news collector error:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error?.name ===
          "AbortError"
            ? "PIB took too long to respond."
            : error?.message ||
              "Failed to collect and evaluate the latest PIB news.",

        articles: [],

        rejectedArticles: [],

        failedEvaluations: [],

        contentFailedArticles:
          [],
      },
      {
        status: 500,
      }
    );
  }
}

export async function POST(request) {
  return GET(request);
}
