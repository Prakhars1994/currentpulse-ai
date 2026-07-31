function cleanText(value = "") {
  return String(value)
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDomain(value = "") {
  return cleanText(value)
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

function normalizeTitle(value = "") {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function domainMatches(url, sourceDomain) {
  try {
    const resultDomain = new URL(url).hostname
      .toLowerCase()
      .replace(/^www\./, "");

    const expectedDomain = normalizeDomain(sourceDomain);

    return (
      resultDomain === expectedDomain ||
      resultDomain.endsWith(`.${expectedDomain}`)
    );
  } catch {
    return false;
  }
}

function calculateTitleScore(articleTitle, resultTitle = "") {
  const articleWords = new Set(
    normalizeTitle(articleTitle)
      .split(" ")
      .filter((word) => word.length > 3)
  );

  const resultWords = new Set(
    normalizeTitle(resultTitle)
      .split(" ")
      .filter((word) => word.length > 3)
  );

  if (!articleWords.size || !resultWords.size) {
    return 0;
  }

  let matchingWords = 0;

  for (const word of articleWords) {
    if (resultWords.has(word)) {
      matchingWords += 1;
    }
  }

  return matchingWords / articleWords.size;
}

function isRejectedUrl(url = "") {
  const lowerUrl = url.toLowerCase();

  const rejectedParts = [
    "/tag/",
    "/tags/",
    "/topic/",
    "/topics/",
    "/category/",
    "/categories/",
    "/author/",
    "/authors/",
    "/search",
    "/video/",
    "/videos/",
    "/photo/",
    "/photos/",
  ];

  return rejectedParts.some((part) => lowerUrl.includes(part));
}

export async function resolvePublisherUrl(
  articleTitle,
  sourceDomain
) {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;

  if (!apiKey || !searchEngineId) {
    console.error(
      "[Publisher resolver] Google Search credentials are missing."
    );

    return "";
  }

  const title = cleanText(articleTitle);
  const domain = normalizeDomain(sourceDomain);

  if (!title || !domain) {
    return "";
  }

  try {
    const searchQuery = `site:${domain} "${title}"`;

    const params = new URLSearchParams({
      key: apiKey,
      cx: searchEngineId,
      q: searchQuery,
      num: "5",
    });

    const response = await fetch(
      `https://www.googleapis.com/customsearch/v1?${params.toString()}`,
      {
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const errorText = await response.text();

      console.error(
        `[Publisher resolver] Search failed with HTTP ${response.status}:`,
        errorText
      );

      return "";
    }

    const data = await response.json();
    const searchResults = Array.isArray(data?.items)
      ? data.items
      : [];

    const rankedResults = searchResults
      .filter((result) => {
        return (
          result?.link &&
          domainMatches(result.link, domain) &&
          !isRejectedUrl(result.link)
        );
      })
      .map((result) => ({
        url: result.link,
        title: result.title || "",
        score: calculateTitleScore(title, result.title),
      }))
      .sort((a, b) => b.score - a.score);

    const bestResult = rankedResults[0];

    if (!bestResult || bestResult.score < 0.35) {
      console.log(
        "[Publisher resolver] No confident publisher match found:",
        title
      );

      return "";
    }

    console.log(
      "[Publisher resolver] Publisher URL found:",
      bestResult.url
    );

    return bestResult.url;
  } catch (error) {
    console.error(
      "[Publisher resolver] Unexpected error:",
      error instanceof Error ? error.message : error
    );

    return "";
  }
}
