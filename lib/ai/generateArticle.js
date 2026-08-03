import { Type } from "@google/genai";

import {
  isModelAvailable,
  markModelExhausted,
} from "@/lib/ai/quotaManager";
import { generateWithRouter } from "@/lib/ai/router";
import {
  VALID_CATEGORIES,
  VALID_PAPERS,
  normalizeCategory,
  normalizePaper,
} from "@/lib/contentTaxonomy";
/*
  Current primary model plus stable fallbacks.

  The code automatically tries the next model when a model is unavailable,
  rate-limited or temporarily overloaded.
*/
const MODELS = [
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
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

    image_search_query: {
      type: Type.STRING,
      description:
        "A concrete Wikimedia Commons image-search phrase naming the exact event, institution, place, person, agreement, species, technology or object in the article.",
    },

    visual_summary: {
      type: Type.STRING,
      description:
        "A compact three-part Markdown learning chain showing trigger, core mechanism and UPSC significance.",
    },

    memory_trick: {
      type: Type.STRING,
      description:
        "A short accurate mnemonic or association that helps retain the article's key facts without adding new facts.",
    },

    map_locations: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        "Zero to four real countries, cities, seas, rivers or regions explicitly present in the source and useful to locate on a map.",
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
    "image_search_query",
    "visual_summary",
    "memory_trick",
    "map_locations",
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
    image_search_query: cleanText(article.image_search_query),
    visual_summary: cleanText(article.visual_summary),
    memory_trick: cleanText(article.memory_trick),
    map_locations: Array.isArray(article.map_locations)
      ? article.map_locations.map(cleanText).filter(Boolean).slice(0, 4)
      : [],
  };

  const minimumLengths = {
    title: 10,
    why_news: 40,
    prelims: 80,
    mains: 120,
    question: 20,
    image_search_query: 8,
    visual_summary: 40,
    memory_trick: 20,
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

  const response = await generateWithRouter({
    model,
    contents: prompt,
    config,
  });

  return parseStructuredResponse(response);
}

async function generateWithFallback(prompt, stageName) {
  let lastError;

  for (const model of MODELS) {

  if (!isModelAvailable(model)) {
    console.log(
      `[${stageName}] Skipping ${model}; already exhausted.`
    );
    continue;
  }

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

  markModelExhausted(model);

  console.log(
    `[${stageName}] ${model} daily quota exhausted.`
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
8. Use clean Markdown inside text fields for headings, bullets and emphasis.
9. Bold important Acts, institutions, reports, constitutional provisions,
   schemes, places, dates and key terms using **double asterisks**.
10. Use a compact Markdown table only when it materially improves a factual
    comparison; otherwise prefer bullets.
11. Use Markdown blockquotes for one high-value exam tip or definition where useful.
12. Do not include HTML.
13. Do not mention that the article was written by AI.
14. Make the article easy to revise: prefer specific labelled bullets over long
    paragraphs, and avoid repeating the same point in multiple fields.

FIELD REQUIREMENTS

title:
Write a precise factual headline. Avoid clickbait and unnecessary words.

why_news:
Explain the latest development, the main institution or country involved,
and why the development is relevant. Keep it concise but complete.

prelims:
Provide examination-ready facts as Markdown bullets using "-". Begin useful
points with a bold factual label where possible. Include only facts supported by the source. Focus on
institutions, constitutional or legal terms, locations, reports, technology,
schemes, organisations and important definitions where applicable.

mains:
Write a balanced analysis using these Markdown headings where applicable:
### Background
### Significance
### Key Issues or Challenges
### Way Forward

Connect the development with governance, economy, society, environment,
science, security or international relations as appropriate. Avoid generic
filler.

question:
Write one analytical UPSC Mains-style question. It should require discussion,
examination, evaluation or critical analysis rather than factual recall.

image_search_query:
Write one highly specific image-search phrase for Wikimedia Commons. Name the
exact treaty, institution, court, mission, species, technology, location,
leaders or event visible in a genuinely relevant image. For a dated event,
include the correct year and the principal people or institution named in the
source so an older look-alike event is not selected. Never use a broad category
phrase such as "economy", "parliament" or "international relations".

visual_summary:
Create a three-step revision chain in this exact Markdown pattern:
**Trigger:** ... → **Core idea:** ... → **UPSC link:** ...

memory_trick:
Create one memorable, respectful mnemonic, acronym or mental association from
the supported key facts. Explain the association in one or two sentences.
Never sacrifice factual accuracy for a clever phrase.

map_locations:
Return an array containing only important countries, cities, seas, rivers or
regions explicitly named in the source. Use [] when a map would add no value.

SOURCE MATERIAL

${sourceContent}

Based only on the preceding source material, return the finished article in
the required JSON structure.
`;
}


function createTrustedCoveragePrompt(sourceContent, options = {}) {
  return `
You are a language editor and formatter for CurrentPulse AI.

The material below comes from a trusted UPSC current-affairs source. The topic
has already been selected for UPSC relevance. Do not perform relevance
evaluation and do not reject it.

Your task is limited to improving grammar, English, sentence flow, readability
and organization while converting the supplied material into the required
CurrentPulse JSON fields.

STRICT PRESERVATION RULES

1. Preserve every important fact, date, number, statistic, report, ranking,
   institution, ministry, organisation, constitutional Article, legal
   provision, Act, rule, judgment, committee, scheme, policy, location,
   scientific term, agreement, historical detail, example, PYQ and argument
   present in the source.
2. Do not remove important information merely to shorten the article.
3. Do not add facts, analysis, examples, dates or claims that are absent from
   the source.
4. Do not change the meaning, level of certainty or numerical value of any
   statement.
5. Remove only webpage noise, repeated navigation text and exact repetition.
6. Do not copy awkward wording when grammar can be improved, but retain the
   complete knowledge content.
7. Do not mention AI, rewriting, the source website's navigation, or this
   instruction.
8. Use exactly one approved category and one approved paper. Prefer the source
   hints when they are valid.

SOURCE HINTS

Title: ${cleanText(options.sourceTitle) || "Not supplied"}
Category: ${cleanText(options.sourceCategory) || "Not supplied"}
Paper: ${cleanText(options.sourcePaper) || "Not supplied"}

APPROVED CATEGORIES

${VALID_CATEGORIES.map((category) => `- ${category}`).join("\n")}

APPROVED PAPERS

${VALID_PAPERS.map((paper) => `- ${paper}`).join("\n")}

FIELD MAPPING

- title: Correct the English of the source title without changing its meaning.
- why_news: Preserve the immediate development and its essential context.
- prelims: Place factual material in readable Markdown bullets using "-" and
  bold key labels with **double asterisks**.
- mains: Organize all analytical material under Markdown headings beginning
  with "###". Preserve
  source arguments, significance, concerns, challenges and way forward.
- question: Preserve a supplied Mains/PYQ question where suitable; otherwise
  form one question strictly from the supplied content.
- image_search_query: Name the exact entity/event/object for a highly relevant
  Wikimedia Commons search. Include the event year and principal actors when
  supplied; never use only the broad subject category or an older look-alike event.
- visual_summary: Return a concise Trigger → Core idea → UPSC link chain.
- memory_trick: Create a fact-safe mnemonic from the source's key points.
- map_locations: Return up to four important named geographical locations from
  the source, or [] when geography is not material.

TRUSTED SOURCE MATERIAL

${sourceContent}

Return only the required JSON object.
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
14. Preserve or improve the image_search_query, visual_summary, memory_trick
    and map_locations fields while keeping them grounded in the source.

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

export async function generateArticle(sourceContent, options = {}) {
  if (!process.env.GEMINI_API_KEY && !process.env.OPENROUTER_API_KEY) {
    throw new Error(
      "No AI provider is configured. Add GEMINI_API_KEY or OPENROUTER_API_KEY."
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

  const trustedCoverage = options.mode === "trusted_coverage";

  const draftPrompt = trustedCoverage
    ? createTrustedCoveragePrompt(limitedSource, options)
    : createDraftPrompt(limitedSource);

  const draftArticle = await generateWithFallback(
    draftPrompt,
    trustedCoverage
      ? "Trusted coverage language editing"
      : "Article generation"
  );

  if (trustedCoverage) {
    console.log(
      "[Editorial review] Skipped for trusted coaching coverage."
    );

    return draftArticle;
  }

// Local validation - if the article already looks good, publish it directly.
const looksGood =
  draftArticle.title.length >= 10 &&
  draftArticle.why_news.length >= 40 &&
  draftArticle.prelims.length >= 80 &&
  draftArticle.mains.length >= 120 &&
  draftArticle.question.length >= 20 &&
  draftArticle.image_search_query.length >= 8 &&
  draftArticle.visual_summary.length >= 40 &&
  draftArticle.memory_trick.length >= 20;

if (looksGood) {
  console.log(
    "[Editorial review] Skipped - draft passed local validation."
  );

  return draftArticle;
}

// Only review if validation fails.
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
