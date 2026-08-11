import { Type } from "@google/genai";

import {
  isModelAvailable,
  markModelExhausted,
} from "@/lib/ai/quotaManager";
import { generateWithRouter, getConfiguredAiProviders } from "@/lib/ai/router";
import { assessArticleQuality } from "@/lib/ai/articleQuality";
import {
  VALID_CATEGORIES,
  VALID_PAPERS,
  normalizeCategory,
  normalizePaper,
} from "@/lib/contentTaxonomy";
import { buildSourceGroundedNewsFallback, buildTrustedCoverageFallback } from "@/lib/ai/trustedCoverageFallback";
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

function validateArticle(article, mode = "upsc") {
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

  const minimumLengths = mode === "news"
    ? {
        title: 10,
        why_news: 80,
        static_foundation: 80,
        data_examples: 80,
      }
    : {
        title: 10,
        why_news: 80,
        syllabus_linkage: 35,
        india_relevance: 45,
        static_foundation: 180,
        data_examples: 180,
        prelims: 180,
        mains: 500,
        answer_framework: 220,
        question: 20,
        visual_summary: 35,
      };

  for (const [field, minimumLength] of Object.entries(minimumLengths)) {
    if (normalizedArticle[field].length < minimumLength) {
      throw new Error(`Gemini returned an incomplete "${field}" field.`);
    }
  }

  if (!VALID_CATEGORIES.includes(normalizedArticle.category)) {
    throw new Error("Gemini returned an invalid category.");
  }

  if (!VALID_PAPERS.includes(normalizedArticle.paper)) {
    throw new Error("Gemini returned an invalid GS paper.");
  }

  const quality = assessArticleQuality(normalizedArticle, { mode });
  if (!quality.passed) {
    throw new Error(
      `Article quality validation failed (${quality.score}/100): ${quality.flags.join(", ")}.`
    );
  }

  return { ...normalizedArticle, quality };
}

function parseStructuredResponse(response, mode = "upsc") {
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
    return validateArticle(JSON.parse(cleanedText), mode);
  } catch (error) {
    console.error("Invalid Gemini response:", cleanedText);

    throw new Error(
      `Invalid JSON returned by Gemini: ${error.message}`
    );
  }
}

async function callGemini(model, prompt, mode = "upsc") {
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

  return parseStructuredResponse(response, mode);
}

async function generateWithFallback(prompt, stageName, mode = "upsc") {
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

        const result = await callGemini(model, prompt, mode);

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
17. Target 650-1,100 useful words across the knowledge fields. CurrentPulse is
    a revision product, not a textbook chapter: every line must add a fact,
    concept, example, comparison or analytical dimension.
18. Treat freshness as a hard rule. Current office-holders, recent statistics,
    rankings, prices, dates and policy status must come from the supplied source.
    Never fill a current fact from model memory.

FIELD REQUIREMENTS

title:
Write a precise factual headline. Avoid clickbait and unnecessary words.

why_news:
In 90-140 words explain exactly what happened, when, who is involved and the
verified trigger. Do not turn this into generic background.

syllabus_linkage:
Keep this deliberately small: 2-3 compact Markdown bullets only. Give the
Prelims domain, Mains GS paper/topic and one current-static link. No paragraphs.

india_relevance:
Explain the concrete India impact or interest. For an India topic, state the
governance/economic/social/environmental/security consequence. For international
news, prove the India, neighbourhood or global-systemic relevance. Do not use
the empty phrase "important for UPSC".

static_foundation:
Give only the stable foundation needed to understand the news: 5-7 short
Markdown bullets, normally 80-160 words total. Prefer definition → institution/
legal basis → mechanism → one essential background fact. Avoid long sentences.

data_examples:
Create exactly 5-6 high-value source-backed bullets where the source supports
that many. Prioritise the newest **data**, **reports**, **laws**, **judgments**,
**cases**, **schemes** and named examples. Bold the decisive figure/name/date
inside each bullet. Never fabricate a number merely to reach six items.

prelims:
Provide 5-8 short examination-ready Markdown bullets. Bold the key fact inside
the sentence, not only the label. Add at most 2 concise "Prelims traps" when
supported. This section must scan quickly on a phone.

mains:
Write a 220-380 word balanced analysis with short bullets under relevant headings:
### Background
### Significance
### India-specific Implications
### Challenges and Criticisms
### Way Forward
Use multiple dimensions (constitutional, governance, economic, social,
environmental, technological, ethical, federal or international) only when
they genuinely apply. Include source-backed examples and avoid generic filler.

answer_framework:
Create a practical 100-170 word answer plan under "### Introduction",
"### Body" and "### Conclusion". Include 5-8 body points and show where one
data point, law/report or example can be used. This is an outline, not a copy
of the mains field.

question:
Write one analytical UPSC Mains-style question. It should require discussion,
examination, evaluation or critical analysis rather than factual recall.

image_search_query:
Write one highly specific Wikimedia Commons query for a reusable photograph,
official diagram, exact object/species, named place or principal institution in
the event. Prefer institutions, technology, geography, documents and physical
subjects over politician portraits. For a genuinely current event, include the
event year so stale imagery can be rejected. Return an empty query when a
clearly relevant reusable image is unlikely. Never request generic stock charts,
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


function createNewsPrompt(sourceContent) {
  return `
You are the general-news editor for CurrentPulse AI. This output is for ordinary
readers, not an exam-preparation template.

Write one concise, neutral, source-grounded news article from the supplied
material. Do not add UPSC syllabus language, Prelims traps, Mains analysis,
answer-writing advice or exam questions.

EDITORIAL RULES

1. Use only facts supported by the source material. Never invent current names,
   offices, dates, statistics, quotations, prices, rankings or policy status.
2. Treat freshness as a hard requirement. If a current fact is not in the
   source, omit it instead of filling it from memory.
3. Lead with what happened, who did it, where and when. Separate verified fact
   from background or interpretation.
4. Keep language neutral, non-partisan and non-sensational.
5. Prefer short paragraphs and bullets. Bold meaningful figures, institutions,
   places, dates and key terms inside sentences.
6. Do not mention UPSC, Prelims, Mains, GS papers or exam relevance anywhere in
   reader-facing fields.
7. International/local stories must be explained on their own news value; do
   not manufacture an India angle.
8. No HTML. Use Markdown only.

APPROVED CATEGORIES
${VALID_CATEGORIES.map((category) => `- ${category}`).join("\n")}

FIELD MAPPING (the database schema is shared with Current Affairs)

- title: precise factual, search-friendly headline.
- why_news: 70-110 word news lead/summary.
- syllabus_linkage: return an empty string.
- india_relevance: use this field as "### Why it matters" with 2-4 concise
  public-interest implications only when supported; otherwise return "".
- static_foundation: use this field as "### Context" with 3-5 short bullets
  explaining only the background needed to understand the news.
- data_examples: use this field as "### Key facts" with 4-6 source-backed
  bullets, prioritising current numbers, dates, decisions and named entities.
- prelims: return an empty string.
- mains: return an empty string.
- answer_framework: return an empty string.
- question: return an empty string.
- image_search_query: a specific Wikimedia Commons query for the exact entity,
  object, institution or place. Prefer non-portrait subject imagery; include the
  event year for current-event images. Return "" when no clearly relevant
  reusable image is likely.
- visual_summary: one line: **What happened:** ... → **Why it matters:** ...
- memory_trick: return an empty string.
- map_locations: up to four important geographical locations explicitly named
  in the source, or [].

SOURCE MATERIAL
${sourceContent}

Return only the required JSON object.`;
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
- syllabus_linkage: 2-3 compact bullets only: Prelims domain, GS paper/topic and current-static link.
- india_relevance: State the concrete India, neighbourhood or global-systemic
  relevance. Never use only "important for UPSC".
- static_foundation: Consolidate only the essential stable base into 5-7 short bullets; avoid essay paragraphs.
- data_examples: Surface the best 5-6 current data/report/case/example bullets first, with important figures, dates and institutions bolded. Preserve additional unique evidence only when indispensable.
- prelims: Use 5-8 short high-yield bullets plus at most 2 supported traps. Bold decisive facts inside bullets.
- mains: Use "### Background", "### Significance", "### India-specific
  Implications", "### Challenges and Criticisms" and "### Way Forward" where
  applicable. Preserve all unique source arguments and cases.
- answer_framework: A 100-170 word Introduction/Body/Conclusion outline using
  the best evidence from the source bundle.
- question: Preserve a supplied Mains/PYQ question where suitable; otherwise
  form one question strictly from the supplied content.
- image_search_query: Name the exact entity/event/object/institution and describe
  what must be visible in a highly relevant Wikimedia Commons result. Prefer
  subject/institution/geography imagery over politician portraits. Include the
  event year for current imagery; return an empty query when freshness cannot be
  supported; reject generic category imagery.
- visual_summary: Return a concise Trigger → Core idea → UPSC link chain.
- memory_trick: Create a fact-safe mnemonic from the source's key points.
- map_locations: Return up to four important named geographical locations from
  the source, or [] when geography is not material.

TRUSTED SOURCE MATERIAL

${sourceContent}

Return only the required JSON object.
  `;
}

function createReviewPrompt(sourceContent, draftArticle, mode = "upsc") {
  return `
You are the final fact-checker and editorial reviewer for CurrentPulse AI.
${mode === "news" ? "Review this as a general-public news article. Remove all UPSC/Prelims/Mains framing." : "Review this as a concise UPSC Current Affairs article."}

Review the DRAFT ARTICLE against the ORIGINAL SOURCE MATERIAL.

Your task is to return a corrected final article, not a review report.

REVIEW CHECKLIST

1. Remove every claim that is not supported by the source.
2. Correct misleading, exaggerated or overly certain language.
3. Check names, dates, figures, institutions, locations and terminology.
4. Make the immediate news development clear.
5. Ensure the category is exactly one approved category.
6. Ensure the paper is exactly one approved paper.
7. ${mode === "news" ? "Keep this a general-public news story with no UPSC, Prelims, Mains or exam framing." : "Strengthen UPSC relevance without inventing facts."}
8. ${mode === "news" ? "Keep the context and key-facts fields concise and newsroom-oriented." : "Keep Prelims facts factual, short and useful."}
9. ${mode === "news" ? "Return empty strings for syllabus_linkage, prelims, mains, answer_framework, question and memory_trick." : "Keep Mains analysis balanced and non-partisan."}
10. ${mode === "news" ? "Do not manufacture an India angle for unrelated foreign news." : "Ensure the proposed question matches the article."}
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


function normaliseGroundingText(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/,/g, "")
    .replace(/\bper\s+cent\b/g, "%")
    .replace(/\s*%/g, "%")
    .replace(/\s+/g, " ")
    .trim();
}

function currentFactTokens(value = "") {
  const raw = normaliseGroundingText(value);
  const tokens = new Set();
  for (const match of raw.matchAll(/\b(?:2024|2025|2026)\b/g)) tokens.add(match[0]);
  for (const match of raw.matchAll(/\b\d+(?:\.\d+)?(?:%|\s+(?:crore|lakh|million|billion|trillion))\b/gi)) {
    tokens.add(normaliseGroundingText(match[0]));
  }
  return [...tokens];
}

function validateFreshnessGrounding(article, sourceContent) {
  const source = normaliseGroundingText(sourceContent);
  const sensitive = [article.why_news, article.india_relevance, article.data_examples]
    .filter(Boolean)
    .join("\n");
  const unsupported = currentFactTokens(sensitive).filter((token) => !source.includes(token));

  const rolePattern = /\b(?:prime minister|president of india|chief justice of india|rbi governor|finance minister|home minister|defence minister|external affairs minister|chief minister)\s+(?:shri\s+)?([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,3})/g;
  for (const match of sensitive.matchAll(rolePattern)) {
    const name = normaliseGroundingText(match[1]);
    const surname = name.split(" ").filter(Boolean).at(-1);
    if (surname && !source.includes(surname)) unsupported.push(`current-role:${match[0]}`);
  }

  if (unsupported.length) {
    throw new Error(`Freshness/source grounding failed: ${[...new Set(unsupported)].slice(0, 6).join(", ")}`);
  }
}

export async function generateArticle(sourceContent, options = {}) {
  const trustedCoverage = options.mode === "trusted_coverage";
  const newsMode = options.mode === "news";
  const validationMode = newsMode ? "news" : "upsc";
  const allowTrustedFallback = trustedCoverage && options.allowTrustedFallback !== false;
  const allowNewsFallback = newsMode && options.allowSourceFallback === true;

  if (!getConfiguredAiProviders().length && !allowTrustedFallback) {
    throw new Error(
      "No AI provider is configured. Add a supported AI provider key."
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
    : newsMode
      ? createNewsPrompt(limitedSource)
      : createDraftPrompt(limitedSource);

  let draftArticle;

  try {
    if (!getConfiguredAiProviders().length) {
      throw new Error("No AI provider is currently configured.");
    }

    draftArticle = await generateWithFallback(
      draftPrompt,
      trustedCoverage
        ? "Trusted coverage language editing"
        : newsMode
          ? "General news generation"
          : "Article generation",
      validationMode
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

    const outputFailure = isOutputError(error);
    if ((!allowTrustedFallback && !allowNewsFallback) || (!providerUnavailable && !outputFailure)) throw error;

    console.warn(
      "[AI fallback] Provider pool unavailable; returning a source-grounded brief to the publication quality gate."
    );
    const fallback = newsMode
      ? buildSourceGroundedNewsFallback(limitedSource, options)
      : buildTrustedCoverageFallback(limitedSource, options);
    validateFreshnessGrounding(fallback, limitedSource);
    return fallback;
  }

  try {
    validateFreshnessGrounding(draftArticle, limitedSource);
  } catch (groundingError) {
    console.warn("[Freshness gate] Draft introduced unsupported current facts; requesting a source-only correction:", groundingError?.message || groundingError);
    const correctionPrompt = createReviewPrompt(limitedSource, draftArticle, validationMode);
    draftArticle = await generateWithFallback(correctionPrompt, "Freshness correction", validationMode);
    validateFreshnessGrounding(draftArticle, limitedSource);
  }

  if (trustedCoverage) {
    console.log("[Editorial review] Skipped for trusted coaching coverage.");
    return draftArticle;
  }

  if (newsMode) {
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
  draftArticle,
  validationMode
);

const reviewedArticle = await generateWithFallback(
  reviewPrompt,
  "Editorial review",
  validationMode
);
validateFreshnessGrounding(reviewedArticle, limitedSource);
return reviewedArticle;
}
