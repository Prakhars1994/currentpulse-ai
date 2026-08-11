import * as cheerio from "cheerio";

const FETCH_TIMEOUT_MS = 15000;

function normalizeUrl(value, baseUrl = "") {
  if (!value || typeof value !== "string") return "";

  try {
    return new URL(value.trim(), baseUrl).toString();
  } catch {
    return "";
  }
}

function cleanEscapedText(value = "") {
  return String(value)
    .replace(/\\u0026/gi, "&")
    .replace(/\\u003d/gi, "=")
    .replace(/\\u003f/gi, "?")
    .replace(/\\u002f/gi, "/")
    .replace(/\\u003a/gi, ":")
    .replace(/\\u0025/gi, "%")
    .replace(/\\x26/gi, "&")
    .replace(/\\x3d/gi, "=")
    .replace(/\\x3f/gi, "?")
    .replace(/\\x2f/gi, "/")
    .replace(/\\x3a/gi, ":")
    .replace(/\\\//g, "/")
    .replace(/&amp;/gi, "&")
    .replace(/&#x2F;/gi, "/")
    .replace(/&#47;/gi, "/")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function isGoogleNewsUrl(url = "") {
  try {
    const hostname = new URL(url).hostname.toLowerCase();

    return (
      hostname === "news.google.com" ||
      hostname.endsWith(".news.google.com")
    );
  } catch {
    return false;
  }
}

function isGoogleOwnedUrl(url = "") {
  try {
    const hostname = new URL(url).hostname.toLowerCase();

    return (
      hostname === "google.com" ||
      hostname.endsWith(".google.com") ||
      hostname === "googleusercontent.com" ||
      hostname.endsWith(".googleusercontent.com") ||
      hostname === "gstatic.com" ||
      hostname.endsWith(".gstatic.com")
    );
  } catch {
    return false;
  }
}

function normalizeSourceDomain(sourceDomain = "") {
  const cleaned = String(sourceDomain)
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];

  return cleaned;
}

function hostnameMatchesSource(url, sourceDomain = "") {
  const expectedDomain = normalizeSourceDomain(sourceDomain);

  if (!url || !expectedDomain) return false;

  try {
    const hostname = new URL(url).hostname
      .toLowerCase()
      .replace(/^www\./, "");

    return (
      hostname === expectedDomain ||
      hostname.endsWith(`.${expectedDomain}`)
    );
  } catch {
    return false;
  }
}

function isRejectedPublisherUrl(url = "") {
  if (!url || !/^https?:\/\//i.test(url)) return true;

  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();
    const pathname = parsedUrl.pathname.toLowerCase();

    const rejectedDomains = [
      "google.com",
      "google.co.in",
      "google-analytics.com",
      "googletagmanager.com",
      "googlesyndication.com",
      "doubleclick.net",
      "gstatic.com",
      "googleusercontent.com",
      "youtube.com",
      "youtu.be",
      "facebook.com",
      "twitter.com",
      "x.com",
      "instagram.com",
      "linkedin.com",
    ];

    const rejectedExtensions = [
      ".js",
      ".css",
      ".json",
      ".xml",
      ".woff",
      ".woff2",
      ".ttf",
      ".ico",
      ".svg",
    ];

    const rejectedParts = [
      "analytics",
      "tracking",
      "tracker",
      "pixel",
      "tagmanager",
      "doubleclick",
      "advert",
      "/ads/",
      "/login",
      "/signin",
      "/privacy",
      "/terms",
      "/support",
      "/preferences",
      "/settings",
    ];

    if (
      rejectedDomains.some(
        (domain) =>
          hostname === domain ||
          hostname.endsWith(`.${domain}`)
      )
    ) {
      return true;
    }

    if (
      rejectedExtensions.some((extension) =>
        pathname.endsWith(extension)
      )
    ) {
      return true;
    }

    return rejectedParts.some((part) =>
      url.toLowerCase().includes(part)
    );
  } catch {
    return true;
  }
}

function isRejectedImage(url = "") {
  const lowerUrl = String(url).toLowerCase();

  const rejectedParts = [
    "googleusercontent.com",
    "gstatic.com",
    "google.com",
    "logo",
    "favicon",
    "icon",
    "avatar",
    "sprite",
    "placeholder",
    "default-image",
    "default_image",
    "blank.gif",
    "spacer.gif",
    "loading.gif",
    "tracking",
    "pixel.gif",
  ];

  return rejectedParts.some((part) => lowerUrl.includes(part));
}

function unwrapGoogleRedirectUrl(value = "") {
  const cleanedValue = cleanEscapedText(value);
  const normalized = normalizeUrl(cleanedValue);

  if (!normalized) return "";

  try {
    const parsed = new URL(normalized);
    const hostname = parsed.hostname.toLowerCase();

    if (
      hostname === "google.com" ||
      hostname.endsWith(".google.com")
    ) {
      const redirectedUrl =
        parsed.searchParams.get("url") ||
        parsed.searchParams.get("q") ||
        parsed.searchParams.get("u");

      if (redirectedUrl) {
        return normalizeUrl(
          cleanEscapedText(
            decodeURIComponent(redirectedUrl)
          )
        );
      }
    }

    return normalized;
  } catch {
    return "";
  }
}

function addPublisherCandidate(
  candidates,
  candidate,
  baseUrl = ""
) {
  if (!candidate || typeof candidate !== "string") return;

  const cleanedCandidate = cleanEscapedText(candidate);
  const normalizedCandidate =
    unwrapGoogleRedirectUrl(cleanedCandidate) ||
    normalizeUrl(cleanedCandidate, baseUrl);

  if (
    normalizedCandidate &&
    !isRejectedPublisherUrl(normalizedCandidate)
  ) {
    candidates.push(normalizedCandidate);
  }
}

function extractUrlsFromRawText(
  rawText,
  candidates,
  baseUrl = ""
) {
  if (!rawText) return;

  const cleanedText = cleanEscapedText(rawText);

  /*
   * Match ordinary and escaped HTTP URLs embedded inside scripts,
   * JSON, data attributes and Google News page data.
   */
  const urlPatterns = [
    /https?:\/\/[^\s"'<>\\]+/gi,
    /https?:\\\/\\\/[^\s"'<>]+/gi,
  ];

  for (const pattern of urlPatterns) {
    const matches = cleanedText.match(pattern) || [];

    for (const match of matches) {
      const cleanedMatch = cleanEscapedText(match)
        .replace(/[),.;\]}]+$/g, "");

      addPublisherCandidate(
        candidates,
        cleanedMatch,
        baseUrl
      );
    }
  }
}

async function fetchHtml(url) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    FETCH_TIMEOUT_MS
  );

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
          "AppleWebKit/537.36 (KHTML, like Gecko) " +
          "Chrome/131.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9," +
          "image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-IN,en;q=0.9",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
    });

    const html = await response.text();

    return {
      html,
      finalUrl: response.url || url,
      status: response.status,
      ok: response.ok,
    };
  } catch (error) {
    console.error(
      "[Image extractor] Fetch failed:",
      url,
      error instanceof Error ? error.message : error
    );

    return {
      html: "",
      finalUrl: "",
      status: 0,
      ok: false,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function buildGoogleNewsUrlVariants(googleNewsUrl) {
  const variants = new Set([googleNewsUrl]);

  try {
    const parsedUrl = new URL(googleNewsUrl);
    const articleMatch = parsedUrl.pathname.match(
      /\/(?:rss\/)?articles\/([^/?#]+)/
    );

    if (articleMatch?.[1]) {
      const articleId = articleMatch[1];

      variants.add(
        `https://news.google.com/articles/${articleId}?hl=en-IN&gl=IN&ceid=IN:en`
      );

      variants.add(
        `https://news.google.com/rss/articles/${articleId}?hl=en-IN&gl=IN&ceid=IN:en`
      );

      variants.add(
        `https://news.google.com/rss/articles/${articleId}?oc=5&hl=en-IN&gl=IN&ceid=IN:en`
      );
    }
  } catch {
    // Keep the original URL only.
  }

  return [...variants];
}

function selectBestPublisherUrl(
  candidates,
  sourceDomain
) {
  const uniqueCandidates = [...new Set(candidates)].filter(
    (candidate) =>
      candidate &&
      !isRejectedPublisherUrl(candidate)
  );

  const expectedDomain =
    normalizeSourceDomain(sourceDomain);

  /*
   * Only accept the expected publisher domain when it is known.
   * This prevents analytics, advertising and unrelated URLs
   * from being mistaken for the article page.
   */
  if (expectedDomain) {
    const sourceMatch = uniqueCandidates.find(
      (candidate) =>
        hostnameMatchesSource(
          candidate,
          expectedDomain
        )
    );

    return sourceMatch || "";
  }

  /*
   * When the source domain is unknown, only accept URLs that
   * look like normal HTML article pages.
   */
  return (
    uniqueCandidates.find((candidate) => {
      try {
        const parsedUrl = new URL(candidate);
        const pathname =
          parsedUrl.pathname.toLowerCase();

        return (
          pathname.length > 1 &&
          !pathname.endsWith(".js") &&
          !pathname.endsWith(".css") &&
          !pathname.endsWith(".json") &&
          !pathname.endsWith(".xml")
        );
      } catch {
        return false;
      }
    }) || ""
  );
}

export async function resolveGoogleNewsPublisherUrl(
  googleNewsUrl,
  sourceDomain
) {
  try {
    const allCandidates = [];

    console.log(
  "[Image extractor] Expected source domain:",
  sourceDomain || "not provided"
);
    const googleUrlVariants =
      buildGoogleNewsUrlVariants(googleNewsUrl);

    for (const urlVariant of googleUrlVariants) {
      const { html, finalUrl } =
        await fetchHtml(urlVariant);

      /*
       * Google may directly redirect to the publisher.
       */
      if (
        finalUrl &&
        !isGoogleNewsUrl(finalUrl) &&
        !isRejectedPublisherUrl(finalUrl)
      ) {
        addPublisherCandidate(
          allCandidates,
          finalUrl,
          urlVariant
        );
      }

      if (!html) continue;

      const $ = cheerio.load(html);

      /*
       * Standard anchor links.
       */
      $("a[href]").each((_, element) => {
        addPublisherCandidate(
          allCandidates,
          $(element).attr("href"),
          urlVariant
        );
      });

      /*
       * Google News sometimes stores the real URL inside data
       * attributes rather than href.
       */
      $(
        "[data-n-au], [data-url], [data-href], [data-link], [data-source-url]"
      ).each((_, element) => {
        const attributes = [
          "data-n-au",
          "data-url",
          "data-href",
          "data-link",
          "data-source-url",
        ];

        for (const attribute of attributes) {
          addPublisherCandidate(
            allCandidates,
            $(element).attr(attribute),
            urlVariant
          );
        }
      });

      /*
       * Canonical and social metadata.
       */
      const metadataCandidates = [
        $('link[rel="canonical"]').attr("href"),
        $('meta[property="og:url"]').attr("content"),
        $('meta[name="twitter:url"]').attr("content"),
        $('meta[property="twitter:url"]').attr(
          "content"
        ),
      ];

      for (const candidate of metadataCandidates) {
        addPublisherCandidate(
          allCandidates,
          candidate,
          urlVariant
        );
      }

      /*
       * Search the complete HTML because modern Google News pages
       * frequently embed the publisher URL in JavaScript data.
       */
      extractUrlsFromRawText(
        html,
        allCandidates,
        urlVariant
      );

      const resolvedUrl = selectBestPublisherUrl(
        allCandidates,
        sourceDomain
      );

      if (resolvedUrl) {
        console.log(
          "[Image extractor] Resolved publisher URL:",
          resolvedUrl
        );

        return resolvedUrl;
      }
    }

    return "";
  } catch (error) {
    console.error(
      "[Image extractor] Google News resolution failed:",
      error instanceof Error ? error.message : error
    );

    return "";
  }
}

function collectJsonLdImages($, candidates) {
  $('script[type="application/ld+json"]').each(
    (_, element) => {
      try {
        const rawJson = $(element).html();

        if (!rawJson) return;

        const parsedJson = JSON.parse(rawJson);

        const processItem = (item) => {
          if (!item || typeof item !== "object") return;

          if (item.image) {
            if (typeof item.image === "string") {
              candidates.push(item.image);
            } else if (Array.isArray(item.image)) {
              for (const image of item.image) {
                if (typeof image === "string") {
                  candidates.push(image);
                } else if (image?.url) {
                  candidates.push(image.url);
                } else if (image?.contentUrl) {
                  candidates.push(image.contentUrl);
                }
              }
            } else if (item.image?.url) {
              candidates.push(item.image.url);
            } else if (item.image?.contentUrl) {
              candidates.push(item.image.contentUrl);
            }
          }

          if (item.thumbnailUrl) {
            candidates.push(item.thumbnailUrl);
          }

          if (item.contentUrl) {
            candidates.push(item.contentUrl);
          }

          if (Array.isArray(item["@graph"])) {
            for (const graphItem of item["@graph"]) {
              processItem(graphItem);
            }
          }

          /*
           * Some publishers nest article metadata inside another
           * JSON-LD property.
           */
          for (const value of Object.values(item)) {
            if (
              value &&
              typeof value === "object" &&
              value !== item.image &&
              value !== item["@graph"]
            ) {
              if (Array.isArray(value)) {
                for (const nestedItem of value) {
                  processItem(nestedItem);
                }
              } else {
                processItem(value);
              }
            }
          }
        };

        if (Array.isArray(parsedJson)) {
          for (const item of parsedJson) {
            processItem(item);
          }
        } else {
          processItem(parsedJson);
        }
      } catch {
        // Ignore malformed JSON-LD blocks.
      }
    }
  );
}

function collectSrcsetImages(srcset = "", candidates) {
  if (!srcset) return;

  const entries = srcset.split(",");

  for (const entry of entries) {
    const imageUrl = entry.trim().split(/\s+/)[0];

    if (imageUrl) {
      candidates.push(imageUrl);
    }
  }
}

async function extractPublisherImage(publisherUrl) {
  try {
    const { html, finalUrl } =
      await fetchHtml(publisherUrl);

    if (!html) return "";

    const pageUrl = finalUrl || publisherUrl;
    const $ = cheerio.load(html);

    const candidates = [
      $('meta[property="og:image:secure_url"]').attr(
        "content"
      ),
      $('meta[property="og:image"]').attr("content"),
      $('meta[name="twitter:image"]').attr("content"),
      $('meta[name="twitter:image:src"]').attr(
        "content"
      ),
      $('meta[property="twitter:image"]').attr(
        "content"
      ),
      $('link[rel="image_src"]').attr("href"),
    ];

    collectJsonLdImages($, candidates);

    /*
     * Article-body images are fallback candidates.
     */
    $("article img, main img, figure img").each(
      (_, element) => {
        candidates.push(
          $(element).attr("src"),
          $(element).attr("data-src"),
          $(element).attr("data-lazy-src"),
          $(element).attr("data-original"),
          $(element).attr("data-image")
        );

        collectSrcsetImages(
          $(element).attr("srcset"),
          candidates
        );

        collectSrcsetImages(
          $(element).attr("data-srcset"),
          candidates
        );
      }
    );

    const validImages = [];

    for (const candidate of candidates) {
      const imageUrl = normalizeUrl(candidate, pageUrl);

      if (
        imageUrl &&
        /^https?:\/\//i.test(imageUrl) &&
        !isRejectedImage(imageUrl)
      ) {
        validImages.push(imageUrl);
      }
    }

    return [...new Set(validImages)][0] || "";
  } catch (error) {
    console.error(
      "[Image extractor] Publisher image extraction failed:",
      error instanceof Error ? error.message : error
    );

    return "";
  }
}

export async function extractImageFromArticle(
  articleUrl,
  sourceDomain = "",
  articleTitle = ""
) {
  try {
    let publisherUrl = articleUrl;

    if (isGoogleNewsUrl(articleUrl)) {
      console.log(
        "[Image extractor] Resolving Google News URL:",
        articleUrl
      );

      publisherUrl =
        await resolveGoogleNewsPublisherUrl(
          articleUrl,
          sourceDomain
        );

      if (!publisherUrl) {
  console.log(
    "[Image extractor] Publisher URL could not be resolved."
  );

  console.log(
    "[Image extractor] Article title:",
    articleTitle
  );

  console.log(
    "[Image extractor] Source domain:",
    sourceDomain
  );

  return "";
}
    }

    console.log(
      "[Image extractor] Publisher URL:",
      publisherUrl
    );

    const imageUrl =
      await extractPublisherImage(publisherUrl);

    if (imageUrl) {
      console.log(
        "[Image extractor] Publisher image:",
        imageUrl
      );
    } else {
      console.log(
        "[Image extractor] No suitable publisher image found."
      );
    }

    return imageUrl;
  } catch (error) {
    console.error(
      "[Image extractor] Unexpected error:",
      error instanceof Error ? error.message : error
    );

    return "";
  }
}