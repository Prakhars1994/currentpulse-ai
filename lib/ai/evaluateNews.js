import { generateWithRouter } from "@/lib/ai/router";
import { Type } from "@google/genai";
import {
  VALID_CATEGORIES,
  VALID_PAPERS,
  normalizeCategory,
  normalizePaper,
} from "@/lib/contentTaxonomy";

import {
  isModelAvailable,
  markModelExhausted,
} from "@/lib/ai/quotaManager";

const MODELS = [
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
];

const singleEvaluationProperties = {
  index: {
    type: Type.INTEGER,
    description:
      "The exact numerical index supplied with the news item.",
  },

  relevant: {
    type: Type.BOOLEAN,
    description:
      "True only when the news is genuinely useful for UPSC or State PCS preparation.",
  },

  importance: {
    type: Type.INTEGER,
    minimum: 1,
    maximum: 10,
    description:
      "Current-affairs importance score from 1 to 10.",
  },

  category: {
    type: Type.STRING,
    description:
      "Exactly one approved CurrentPulse category.",
  },

  paper: {
    type: Type.STRING,
    description:
      "Exactly one approved UPSC paper.",
  },

  reason: {
    type: Type.STRING,
    description:
      "A concise explanation of why the news is or is not exam relevant.",
  },

  keywords: {
    type: Type.ARRAY,
    items: {
      type: Type.STRING,
    },
    description:
      "Three to eight useful topic keywords.",
  },
};

const batchEvaluationSchema = {
  type: Type.OBJECT,

  properties: {
    evaluations: {
      type: Type.ARRAY,

      items: {
        type: Type.OBJECT,

        properties: singleEvaluationProperties,

        required: [
          "index",
          "relevant",
          "importance",
          "category",
          "paper",
          "reason",
          "keywords",
        ],
      },
    },
  },

  required: ["evaluations"],
};

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function validateEvaluation(result, fallbackIndex = 0) {
  if (!result || typeof result !== "object") {
    throw new Error("Gemini returned an invalid evaluation.");
  }

  const parsedIndex = Number(result.index);

  const index = Number.isInteger(parsedIndex)
    ? parsedIndex
    : fallbackIndex;

  const importance = Math.max(
    1,
    Math.min(10, Number(result.importance) || 1)
  );

  const keywords = Array.isArray(result.keywords)
    ? result.keywords
        .map((keyword) => cleanText(keyword))
        .filter(Boolean)
        .slice(0, 8)
    : [];

  return {
    index,
    relevant: Boolean(result.relevant),
    importance,
    category: normalizeCategory(result.category),
    paper: normalizePaper(result.paper),
    reason:
      cleanText(result.reason) ||
      "The evaluator did not provide a detailed reason.",
    keywords,
  };
}

function parseBatchResponse(response, expectedCount) {
  const text = response?.text?.trim();

  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  const cleanedText = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const parsed = JSON.parse(cleanedText);

  if (!parsed || !Array.isArray(parsed.evaluations)) {
    throw new Error(
      "Gemini did not return an evaluations array."
    );
  }

  const evaluationMap = new Map();

  for (const rawEvaluation of parsed.evaluations) {
    const evaluation = validateEvaluation(rawEvaluation);

    if (
      evaluation.index >= 0 &&
      evaluation.index < expectedCount &&
      !evaluationMap.has(evaluation.index)
    ) {
      evaluationMap.set(evaluation.index, evaluation);
    }
  }

  const evaluations = [];

  for (let index = 0; index < expectedCount; index += 1) {
    const evaluation = evaluationMap.get(index);

    if (evaluation) {
      evaluations.push(evaluation);
      continue;
    }

    evaluations.push({
      index,
      relevant: false,
      importance: 1,
      category: "Polity & Governance",
      paper: "Prelims",
      reason:
        "The AI evaluator did not return a result for this news item.",
      keywords: [],
    });
  }

  return evaluations;
}

function normalizeNewsItems(newsItems) {
  if (!Array.isArray(newsItems)) {
    throw new Error("News items must be supplied as an array.");
  }

  return newsItems
    .map((item, index) => {
      const title = cleanText(item?.title);
      const description = cleanText(
        item?.description || item?.summary
      );

      return {
        index,
        title,
      description: description.slice(0, 900),
      };
    })
    .filter((item) => item.title);
}

function createBatchEvaluationPrompt(newsItems) {
  const formattedNews = newsItems
    .map(
      (item) => `
NEWS INDEX: ${item.index}

TITLE:
${item.title}

DESCRIPTION:
${item.description || "No description was supplied."}
`
    )
    .join("\n----------------------------------------\n");

  return `
You are a senior UPSC and State PCS current-affairs editor for CurrentPulse AI.

Evaluate every supplied news item for examination relevance.

You must return exactly one evaluation for every news index.

NEWS ITEMS

${formattedNews}

APPROVED CATEGORIES

${VALID_CATEGORIES.map((category) => `- ${category}`).join("\n")}

APPROVED PAPERS

${VALID_PAPERS.map((paper) => `- ${paper}`).join("\n")}

EVALUATION RULES

1. Return one evaluation for every supplied news index.
2. Preserve each exact numerical index in the response.
3. Use a high-recall UPSC standard: mark relevant as true whenever the development can support a meaningful Prelims fact, Mains argument, governance example, policy update or syllabus-linked case study.
4. Consider governance, Constitution, judiciary, economy, environment, science, technology, defence, security, international relations, government schemes, geography, history, culture and major social issues.
5. Ignore celebrity gossip, entertainment promotions, routine sports results, local crime without wider significance, advertisements, tenders, navigation pages, archive listings and clickbait.
6. Importance must be an integer from 1 to 10. Use 5-10 for useful exam current affairs; reserve 1-4 for routine, promotional, trivial or non-syllabus news.
7. Select exactly one approved category.
8. Select exactly one approved paper.
9. Give a short and specific reason.
10. Return between three and eight useful keywords where possible.
11. Do not invent facts beyond the supplied title and description.
12. Return only the required JSON object.
`;
}

async function callGeminiBatch(model, prompt, expectedCount) {
  const config = {
    responseMimeType: "application/json",
    responseSchema: batchEvaluationSchema,
    maxOutputTokens: Math.min(
      16000,
      Math.max(4000, expectedCount * 120)
    ),
  };

  if (!model.startsWith("gemini-3")) {
    config.temperature = 0.1;
  }

  try {
    const response = await generateWithRouter({
      model,
      contents: prompt,
      config,
    });

    return parseBatchResponse(response, expectedCount);

  } catch (error) {

    const message = error?.message || "";

    if (
      message.includes("RESOURCE_EXHAUSTED") ||
      message.includes("429") ||
      message.toLowerCase().includes("quota")
    ) {
      markModelExhausted(model);
    }

    throw error;
  }
}

export async function evaluateNewsBatch(newsItems) {
  if (!process.env.GEMINI_API_KEY && !process.env.OPENROUTER_API_KEY) {
    throw new Error(
      "No AI provider is configured. Add GEMINI_API_KEY or OPENROUTER_API_KEY."
    );
  }

  const normalizedItems = normalizeNewsItems(newsItems);

  if (normalizedItems.length === 0) {
    return [];
  }

  const prompt = createBatchEvaluationPrompt(normalizedItems);

  let lastError;

  for (const model of MODELS) {

    if (!isModelAvailable(model)) {
      console.log(
        `[Batch news evaluation] Skipping ${model}; already exhausted.`
      );
      continue;
    }

    
    try {
      console.log(
        `[Batch news evaluation] Evaluating ${normalizedItems.length} items with ${model}`
      );

      const evaluations = await callGeminiBatch(
        model,
        prompt,
        normalizedItems.length
      );

      console.log(
        `[Batch news evaluation] Completed ${evaluations.length} evaluations with ${model}`
      );

      return evaluations;
    } catch (error) {
      lastError = error;

      console.error(
        `[Batch news evaluation] ${model} failed:`,
        error?.message || error
      );
    }
  }

  throw new Error(
    `Batch news evaluation failed with all Gemini models. ${
      lastError?.message || "Please try again."
    }`
  );
}

/**
 * Backward-compatible single-news evaluator.
 *
 * Existing parts of the project that call evaluateNews(title, description)
 * will continue to work.
 */
export async function evaluateNews(title, description = "") {
  const cleanedTitle = cleanText(title);

  if (!cleanedTitle) {
    throw new Error("News title is required.");
  }

  const results = await evaluateNewsBatch([
    {
      title: cleanedTitle,
      description: cleanText(description),
    },
  ]);

  const evaluation = results[0];

  return {
    relevant: evaluation.relevant,
    importance: evaluation.importance,
    category: evaluation.category,
    paper: evaluation.paper,
    reason: evaluation.reason,
    keywords: evaluation.keywords,
  };
}
