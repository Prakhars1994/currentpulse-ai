import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

/*
  Current primary model plus stable fallbacks.

  The code automatically tries the next model when a model is unavailable,
  rate-limited or temporarily overloaded.
*/
const MODELS = [
  "gemini-3.6-flash",
  "gemini-3-flash-preview",
  "gemini-2.5-flash-lite",
];

const VALID_CATEGORIES = [
  "Polity & Governance",
  "Economy",
  "International Relations",
  "Science & Technology",
  "Environment",
  "Defence & Security",
  "Social Issues",
  "Geography",
  "History & Culture",
  "Government Schemes",
];

const VALID_PAPERS = [
  "Prelims",
  "GS-1",
  "GS-2",
  "GS-3",
  "GS-4",
  "Essay",
];

const articleSchema = {
  type: Type.OBJECT,

  properties: {
    title: {
      type: Type.STRING,
      description:
        "A specific, factual and search-friendly current-affairs title.",
    },

    category: {
      type: Type.STRING,
      description:
        "Exactly one approved CurrentPulse current-affairs category.",
    },

    paper: {
      type: Type.STRING,
      description:
        "Exactly one of Prelims, GS-1, GS-2, GS-3, GS-4 or Essay.",
    },

    why_news: {
      type: Type.STRING,
      description:
        "A concise explanation of the immediate verified development.",
    },

    prelims: {
      type: Type.STRING,
      description:
        "Exam-relevant factual points based only on supplied source material.",
    },

    mains: {
      type: Type.STRING,
      description:
        "Balanced Mains analysis covering background, significance, concerns and way forward.",
    },

    question: {
      type: Type.STRING,
      description:
        "One analytical UPSC Mains-style question based on the topic.",
    },
  },

  required: [
    "title",
    "category",
    "paper",
    "why_news",
    "prelims",
    "mains",
    "question",
  ],
};

function wait(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isTemporaryError(error) {
  const status = Number(error?.status);
  const message = String(error?.message || "").toLowerCase();

  // Daily quota exhausted → do NOT retry.
  if (
    message.includes("generaterequestsperdayperprojectpermodel-freetier") ||
    message.includes("quota exceeded for metric") ||
    message.includes("perday") ||
    message.includes("daily")
  ) {
    return false;
  }

  return (
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    message.includes('"code":429') ||
    message.includes('"code":503') ||
    message.includes("resource_exhausted") ||
    message.includes("unavailable") ||
    message.includes("high demand") ||
    message.includes("rate limit") ||
    message.includes("temporarily unavailable") ||
    message.includes("deadline exceeded")
  );
}
function isOutputError(error) {
  const message = String(error?.message || "").toLowerCase();

  return (
    error instanceof SyntaxError ||
    message.includes("json") ||
    message.includes("empty response") ||
    message.includes("invalid article") ||
    message.includes("invalid category") ||
    message.includes("invalid paper")
  );
}

function normalizeCategory(category) {
  const cleanedCategory = cleanText(category);

  const exactMatch = VALID_CATEGORIES.find(
    (validCategory) =>
      validCategory.toLowerCase() === cleanedCategory.toLowerCase()
  );

  if (exactMatch) {
    return exactMatch;
  }

  const categoryText = cleanedCategory.toLowerCase();

  if (
    categoryText.includes("polity") ||
    categoryText.includes("governance") ||
    categoryText.includes("constitution")
  ) {
    return "Polity & Governance";
  }

  if (
    categoryText.includes("economic") ||
    categoryText.includes("economy") ||
    categoryText.includes("banking") ||
    categoryText.includes("finance")
  ) {
    return "Economy";
  }

  if (
    categoryText.includes("international") ||
    categoryText.includes("foreign") ||
    categoryText.includes("diplomacy")
  ) {
    return "International Relations";
  }

  if (
    categoryText.includes("science") ||
    categoryText.includes("technology") ||
    categoryText.includes("space")
  ) {
    return "Science & Technology";
  }

  if (
    categoryText.includes("environment") ||
    categoryText.includes("ecology") ||
    categoryText.includes("climate")
  ) {
    return "Environment";
  }

  if (
    categoryText.includes("defence") ||
    categoryText.includes("defense") ||
    categoryText.includes("security")
  ) {
    return "Defence & Security";
  }

  if (
    categoryText.includes("social") ||
    categoryText.includes("health") ||
    categoryText.includes("education")
  ) {
    return "Social Issues";
  }

  if (categoryText.includes("geograph")) {
    return "Geography";
  }

  if (
    categoryText.includes("history") ||
    categoryText.includes("culture") ||
    categoryText.includes("heritage")
  ) {
    return "History & Culture";
  }

  if (
    categoryText.includes("scheme") ||
    categoryText.includes("programme") ||
    categoryText.includes("program")
  ) {
    return "Government Schemes";
  }

  return "Polity & Governance";
}

function normalizePaper(paper) {
  const cleanedPaper = cleanText(paper)
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace("GENERALSTUDIES", "GS");

  const paperMap = {
    PRELIMS: "Prelims",
    "GS1": "GS-1",
    "GS-1": "GS-1",
    "GS2": "GS-2",
    "GS-2": "GS-2",
    "GS3": "GS-3",
    "GS-3": "GS-3",
    "GS4": "GS-4",
    "GS-4": "GS-4",
    ESSAY: "Essay",
  };

  const normalizedPaper = paperMap[cleanedPaper];

  if (normalizedPaper && VALID_PAPERS.includes(normalizedPaper)) {
    return normalizedPaper;
  }

  return "Prelims";
}

function validateArticle(article) {
  if (!article || typeof article !== "object") {
    throw new Error("Gemini returned an invalid article object.");
  }

  const normalizedArticle = {
    title: cleanText(article.title),
    category: normalizeCategory(article.category),
    paper: normalizePaper(article.paper),
    why_news: cleanText(article.why_news),
    prelims: cleanText(article.prelims),
    mains: cleanText(article.mains),
    question: cleanText(article.question),
  };

  const minimumLengths = {
    title: 10,
    why_news: 40,
    prelims: 80,
    mains: 120,
    question: 20,
  };

  for (const [field, minimumLength] of Object.entries(minimumLengths)) {
    if (normalizedArticle[field].length < minimumLength) {
      throw new Error(
        `Gemini returned an incomplete "${field}" field.`
      );
    }
  }

  if (!VALID_CATEGORIES.includes(normalizedArticle.category)) {
    throw new Error("Gemini returned an invalid category.");
  }

  if (!VALID_PAPERS.includes(normalizedArticle.paper)) {
    throw new Error("Gemini returned an invalid GS paper.");
  }

  return normalizedArticle;
}

function parseStructuredResponse(response) {
  const text = response?.text?.trim();

  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  const cleanedText = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return validateArticle(JSON.parse(cleanedText));
  } catch (error) {
    console.error("Invalid Gemini response:", cleanedText);

    throw new Error(
      `Invalid JSON returned by Gemini: ${error.message}`
    );
  }
}

async function callGemini(model, prompt) {
  const config = {
    responseMimeType: "application/json",
    responseSchema: articleSchema,
  };

  /*
    Gemini 3 models are designed around their default temperature.
    We avoid forcing a low temperature for those models.
  */
  if (!model.startsWith("gemini-3")) {
    config.temperature = 0.2;
  }

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config,
  });

  return parseStructuredResponse(response);
}

async function generateWithFallback(prompt, stageName) {
  let lastError;

  for (const model of MODELS) {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        console.log(
          `[${stageName}] Trying ${model}, attempt ${attempt}`
        );

        const result = await callGemini(model, prompt);

        console.log(
          `[${stageName}] Completed successfully with ${model}`
        );

        return result;
      } catch (error) {
        lastError = error;

        console.error(
          `[${stageName}] ${model}, attempt ${attempt} failed:`,
          error?.message || error
        );

        const temporaryError = isTemporaryError(error);
        const outputError = isOutputError(error);

        const errorMessage = String(
          error?.message || ""
        ).toLowerCase();

        const dailyQuotaExhausted =
          errorMessage.includes(
            "generaterequestsperdayperprojectpermodel-freetier"
          ) ||
          errorMessage.includes("quota exceeded for metric") ||
          errorMessage.includes("perday");

        if (dailyQuotaExhausted) {
          console.log(
            `[${stageName}] Skipping ${model} because its daily quota is exhausted.`
          );

          break;
        }

        if (!temporaryError && !outputError) {
          throw error;
        }

        if (attempt < 2) {
          const delay = 2000 * 2 ** (attempt - 1);

          console.log(
            `[${stageName}] Retrying in ${delay / 1000} seconds...`
          );

          await wait(delay);
        }
      }
    }
  }

  throw new Error(
    `${stageName} failed with all available Gemini models. ${
      lastError?.message || "Please try again."
    }`
  );
}
function createDraftPrompt(sourceContent) {
  return `
You are the senior current-affairs writer for CurrentPulse AI, an Indian
competitive-examination learning platform.

Create one accurate, balanced and examination-focused article from the
SOURCE MATERIAL below.

The article is intended primarily for UPSC Civil Services candidates, while
remaining useful for PCS, SSC, banking and other examination candidates.

APPROVED CATEGORIES

${VALID_CATEGORIES.map((category) => `- ${category}`).join("\n")}

APPROVED PAPERS

${VALID_PAPERS.map((paper) => `- ${paper}`).join("\n")}

EDITORIAL REQUIREMENTS

1. Use only facts supported by the supplied source material.
2. Do not invent dates, statistics, quotations, organisations, reports,
   schemes, locations, legal provisions or government decisions.
3. Do not present assumptions, predictions or opinions as established facts.
4. If the source does not contain sufficient detail, use careful general
   analysis without adding unsupported factual claims.
5. Avoid sensational, partisan, promotional or emotionally loaded language.
6. Explain abbreviations the first time they appear.
7. Select exactly one approved category and exactly one approved paper.
8. Do not include Markdown tables.
9. Do not include HTML.
10. Do not mention that the article was written by AI.

FIELD REQUIREMENTS

title:
Write a precise factual headline. Avoid clickbait and unnecessary words.

why_news:
Explain the latest development, the main institution or country involved,
and why the development is relevant. Keep it concise but complete.

prelims:
Provide examination-ready facts in readable bullet-style text using the
"•" character. Include only facts supported by the source. Focus on
institutions, constitutional or legal terms, locations, reports, technology,
schemes, organisations and important definitions where applicable.

mains:
Write a balanced analysis using clear headings inside the text:
Background
Significance
Key Issues or Challenges
Way Forward

Connect the development with governance, economy, society, environment,
science, security or international relations as appropriate. Avoid generic
filler.

question:
Write one analytical UPSC Mains-style question. It should require discussion,
examination, evaluation or critical analysis rather than factual recall.

SOURCE MATERIAL

${sourceContent}

Based only on the preceding source material, return the finished article in
the required JSON structure.
`;
}

function createReviewPrompt(sourceContent, draftArticle) {
  return `
You are the final fact-checker and UPSC editorial reviewer for CurrentPulse AI.

Review the DRAFT ARTICLE against the ORIGINAL SOURCE MATERIAL.

Your task is to return a corrected final article, not a review report.

REVIEW CHECKLIST

1. Remove every claim that is not supported by the source.
2. Correct misleading, exaggerated or overly certain language.
3. Check names, dates, figures, institutions, locations and terminology.
4. Make the immediate news development clear.
5. Ensure the category is exactly one approved category.
6. Ensure the paper is exactly one approved paper.
7. Strengthen UPSC relevance without inventing facts.
8. Keep Prelims facts factual and useful.
9. Keep Mains analysis balanced and non-partisan.
10. Ensure the proposed question matches the article.
11. Remove repetition and generic filler.
12. Return all required fields even if the original draft needs major changes.
13. Never mention the review process or AI in the final article.

APPROVED CATEGORIES

${VALID_CATEGORIES.map((category) => `- ${category}`).join("\n")}

APPROVED PAPERS

${VALID_PAPERS.map((paper) => `- ${paper}`).join("\n")}

ORIGINAL SOURCE MATERIAL

${sourceContent}

DRAFT ARTICLE

${JSON.stringify(draftArticle, null, 2)}

Return only the corrected final article using the required JSON structure.
`;
}

export async function generateArticle(sourceContent) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY is missing from the environment variables."
    );
  }

  const cleanedSource = cleanText(sourceContent);

  if (!cleanedSource) {
    throw new Error("News content is required.");
  }

  if (cleanedSource.length < 80) {
    throw new Error(
      "The supplied news content is too short. Paste more source information."
    );
  }

  /*
    Prevent extremely large accidental prompts while keeping enough material
    for detailed current-affairs articles.
  */
  const limitedSource = cleanedSource.slice(0, 30000);

  const draftPrompt = createDraftPrompt(limitedSource);

  const draftArticle = await generateWithFallback(
    draftPrompt,
    "Article generation"
  );

  const reviewPrompt = createReviewPrompt(
    limitedSource,
    draftArticle
  );

  const reviewedArticle = await generateWithFallback(
    reviewPrompt,
    "Editorial review"
  );

  return reviewedArticle;
}