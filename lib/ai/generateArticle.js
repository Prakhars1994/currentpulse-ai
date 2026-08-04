import { Type } from "@google/genai";

import {
  isModelAvailable,
  markModelExhausted,
} from "@/lib/ai/quotaManager";
import { generateWithRouter } from "@/lib/ai/router";
import { assessArticleQuality } from "@/lib/ai/articleQuality";
import {
  VALID_CATEGORIES,
  VALID_PAPERS,
  normalizeCategory,
  normalizePaper,
} from "@/lib/contentTaxonomy";
import { buildTrustedCoverageFallback } from "@/lib/ai/trustedCoverageFallback";
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

    syllabus_linkage: {
      type: Type.STRING,
      description: "Exact Prelims and Mains syllabus linkage with topic-level keywords.",
    },

    india_relevance: {
      type: Type.STRING,
      description: "Why this matters for India or for a global system affecting India.",
    },

    static_foundation: {
      type: Type.STRING,
      description: "Stable conceptual, legal, institutional, geographical or scientific foundation linked to the news.",
    },

    data_examples: {
      type: Type.STRING,
      description: "Source-backed data, dates, reports, examples, cases and comparisons for answer enrichment.",
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

    answer_framework: {
      type: Type.STRING,
      description: "A concise UPSC Mains answer framework with introduction, body dimensions and conclusion.",
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
    "syllabus_linkage",
    "india_relevance",
    "static_foundation",
    "data_examples",
    "prelims",
    "mains",
    "answer_framework",
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
    message.includes("invalid paper") ||
    message.includes("quality validation") ||
    message.includes("incomplete")
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
    syllabus_linkage: cleanText(article.syllabus_linkage),
    india_relevance: cleanText(article.india_relevance),
    static_foundation: cleanText(article.static_foundation),
    data_examples: cleanText(article.data_examples),
    prelims: cleanText(article.prelims),
    mains: cleanText(article.mains),
    answer_framework: cleanText(article.answer_framework),
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
    why_news: 90,
    syllabus_linkage: 90,
    india_relevance: 80,
    static_foundation: 500,
    data_examples: 300,
    prelims: 600,
    mains: 1200,
    answer_framework: 450,
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

  const quality = assessArticleQuality(normalizedArticle);
  if (!quality.passed) {
    throw new Error(
      `Article quality validation failed (${quality.score}/100): ${quality.flags.join(", ")}.`
    );
  }

  return { ...normalizedArticle, quality };
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
    maxOutputTokens: 16000,
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
You are the senior UPSC current-affairs editor for CurrentPulse AI.

Create one original, source-grounded UPSC article from the SOURCE MATERIAL.
The quality bar is the strongest Indian UPSC daily-current-affairs products:
clear syllabus mapping, current-to-static linkage, source-backed facts, useful
Prelims traps, multidimensional Mains analysis and a revision-ready answer
framework. Do not copy any publisher's wording or branding.

APPROVED CATEGORIES

${VALID_CATEGORIES.map((category) => `- ${category}`).join("\n")}

APPROVED PAPERS

${VALID_PAPERS.map((paper) => `- ${paper}`).join("\n")}

EDITORIAL REQUIREMENTS

1. Use only facts supported by the supplied source material.
2. Do not invent dates, statistics, quotations, organisations, reports,
   schemes, locations, legal provisions or government decisions.
3. Do not present assumptions, predictions or opinions as established facts.
4. You may explain stable textbook concepts, constitutional structures,
   institutional roles and standard definitions needed for the static link,
   but never invent a current statistic, event detail, legal provision or
   quotation. If uncertain, omit it.
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
    paragraphs and avoid repetition.
15. International news is publishable only when it has a direct India link,
    strategic neighbourhood relevance, or genuinely global-systemic impact.
    Never manufacture an India angle for routine country-specific foreign news.
16. Preserve exact dates, numbers, reports, Acts, Articles, institutions and
    places when present. Attribute important data in the text (for example,
    "**According to RBI...**").
17. Target 900-1,400 useful words across the knowledge fields. Every paragraph
    must add a fact, concept, example, comparison or analytical dimension.

FIELD REQUIREMENTS

title:
Write a precise factual headline. Avoid clickbait and unnecessary words.

why_news:
In 90-140 words explain exactly what happened, when, who is involved and the
verified trigger. Do not turn this into generic background.

syllabus_linkage:
Use Markdown bullets. Give the exact Prelims domain and the relevant Mains GS
paper/topic in syllabus language. Add one line explaining the current-static link.

india_relevance:
Explain the concrete India impact or interest. For an India topic, state the
governance/economic/social/environmental/security consequence. For international
news, prove the India, neighbourhood or global-systemic relevance. Do not use
the empty phrase "important for UPSC".

static_foundation:
Build the stable foundation required to understand the news in 150-250 words.
Use helpful headings and bullets. Depending on the topic, cover definitions,
constitutional/legal framework, institutional design, core economic/scientific
mechanism, historical background or physical geography.

data_examples:
Create a revision box titled "### Data, Reports, Cases & Examples" with 5-10
source-backed bullets. Use dates, numbers, reports, laws, judgments, schemes,
places and named examples actually supplied. If precise numerical data is not
available, use supported named facts and comparisons—never fabricate numbers.

prelims:
Provide 8-14 examination-ready Markdown bullets. Bold factual labels. Include
definitions, institutions, ministry/body, legal basis, location/mapping,
reports, technology, schemes and factual distinctions as applicable. Add a
"### Prelims Traps" subsection with 2-4 common confusions, pairs or statement
pitfalls that can be answered from the material.

mains:
Write a 300-500 word balanced analysis with short bullets under relevant headings:
### Background
### Significance
### India-specific Implications
### Challenges and Criticisms
### Way Forward
Use multiple dimensions (constitutional, governance, economic, social,
environmental, technological, ethical, federal or international) only when
they genuinely apply. Include source-backed examples and avoid generic filler.

answer_framework:
Create a practical 150-220 word answer plan under "### Introduction",
"### Body" and "### Conclusion". Include 5-8 body points and show where one
data point, law/report or example can be used. This is an outline, not a copy
of the mains field.

question:
Write one analytical UPSC Mains-style question. It should require discussion,
examination, evaluation or critical analysis rather than factual recall.

image_search_query:
Write one highly specific Wikimedia Commons query for a photograph, official
diagram, exact object/species, named place or principal institutions/people in
the event. Include India and the event year/actors when supplied. Describe what
must be visible. Never return a generic category image such as stock charts,
random parliament halls, flags without context or generic landscapes.

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
You are a senior UPSC editor synthesizing trusted coaching current-affairs
coverage for CurrentPulse AI.

The material below comes from a trusted UPSC current-affairs source. The topic
has already been selected for UPSC relevance. Do not perform relevance
evaluation and do not reject it.

Create one original hybrid article that preserves every unique supported input,
removes duplication and reorganizes the knowledge into a superior exam-ready
structure. Emulate useful editorial patterns such as syllabus mapping, static
linkage, data boxes, Prelims traps and answer frameworks, but never copy a
source's wording, branded labels or proprietary layout.

STRICT PRESERVATION RULES

1. Preserve every important fact, date, number, statistic, report, ranking,
   institution, ministry, organisation, constitutional Article, legal
   provision, Act, rule, judgment, committee, scheme, policy, location,
   scientific term, agreement, historical detail, example, PYQ and argument
   present in the source.
2. Do not remove important information merely to shorten the article.
3. Do not add current facts, analysis, examples, dates or claims that are absent
   from the source. Stable textbook definitions may be used only when certain
   and necessary for the static foundation.
4. Do not change the meaning, level of certainty or numerical value of any
   statement.
5. Remove only webpage noise, repeated navigation text and exact repetition.
6. Paraphrase and synthesize. Do not reproduce source paragraphs verbatim, but
   retain the complete factual and analytical knowledge content.
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
- why_news: Preserve the immediate development, date, actor and trigger in
  90-140 words.
- syllabus_linkage: Exact Prelims domain plus GS paper/topic in syllabus language.
- india_relevance: State the concrete India, neighbourhood or global-systemic
  relevance. Never use only "important for UPSC".
- static_foundation: Consolidate definitions, history, constitutional/legal
  framework, institutions, geography and mechanisms supplied by the sources.
- data_examples: A "### Data, Reports, Cases & Examples" box containing every
  useful supported date, number, law, report, judgment, scheme and named example.
- prelims: Use 8-14 readable Markdown bullets with bold labels and a
  "### Prelims Traps" subsection for supported confusions/pairs.
- mains: Use "### Background", "### Significance", "### India-specific
  Implications", "### Challenges and Criticisms" and "### Way Forward" where
  applicable. Preserve all unique source arguments and cases.
- answer_framework: A 150-220 word Introduction/Body/Conclusion outline using
  the best evidence from the source bundle.
- question: Preserve a supplied Mains/PYQ question where suitable; otherwise
  form one question strictly from the supplied content.
- image_search_query: Name the exact entity/event/object and describe what must
  be visible in a highly relevant Wikimedia Commons result. Include India, event
  year and principal actors when supplied; reject generic category imagery.
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
  const trustedCoverage = options.mode === "trusted_coverage";
  const allowTrustedFallback = trustedCoverage && options.allowTrustedFallback !== false;

  if (!process.env.GEMINI_API_KEY && !process.env.OPENROUTER_API_KEY && !allowTrustedFallback) {
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

  const draftPrompt = trustedCoverage
    ? createTrustedCoveragePrompt(limitedSource, options)
    : createDraftPrompt(limitedSource);

  let draftArticle;

  try {
    if (!process.env.GEMINI_API_KEY && !process.env.OPENROUTER_API_KEY) {
      throw new Error("No AI provider is currently configured.");
    }

    draftArticle = await generateWithFallback(
      draftPrompt,
      trustedCoverage
        ? "Trusted coverage language editing"
        : "Article generation"
    );
  } catch (error) {
    const message = String(error?.message || "").toLowerCase();
    const providerUnavailable =
      message.includes("429") ||
      message.includes("quota") ||
      message.includes("rate limit") ||
      message.includes("resource_exhausted") ||
      message.includes("unavailable") ||
      message.includes("no ai provider") ||
      message.includes("all available gemini models");

    if (!allowTrustedFallback || !providerUnavailable) throw error;

    console.warn(
      "[Trusted coverage] AI unavailable; publishing a source-grounded brief for later quality upgrade."
    );
    return buildTrustedCoverageFallback(limitedSource, options);
  }

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
