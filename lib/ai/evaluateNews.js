import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const MODELS = [
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
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

const evaluationSchema = {
  type: Type.OBJECT,

  properties: {
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
  },

  required: [
    "relevant",
    "importance",
    "category",
    "paper",
    "reason",
    "keywords",
  ],
};

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeCategory(category) {
  const value = cleanText(category).toLowerCase();

  const exactMatch = VALID_CATEGORIES.find(
    (item) => item.toLowerCase() === value
  );

  if (exactMatch) {
    return exactMatch;
  }

  if (
    value.includes("polity") ||
    value.includes("governance") ||
    value.includes("constitution") ||
    value.includes("judiciary")
  ) {
    return "Polity & Governance";
  }

  if (
    value.includes("economy") ||
    value.includes("economic") ||
    value.includes("finance") ||
    value.includes("banking")
  ) {
    return "Economy";
  }

  if (
    value.includes("international") ||
    value.includes("foreign") ||
    value.includes("diplomacy")
  ) {
    return "International Relations";
  }

  if (
    value.includes("science") ||
    value.includes("technology") ||
    value.includes("space")
  ) {
    return "Science & Technology";
  }

  if (
    value.includes("environment") ||
    value.includes("climate") ||
    value.includes("ecology")
  ) {
    return "Environment";
  }

  if (
    value.includes("defence") ||
    value.includes("defense") ||
    value.includes("security")
  ) {
    return "Defence & Security";
  }

  if (
    value.includes("social") ||
    value.includes("health") ||
    value.includes("education")
  ) {
    return "Social Issues";
  }

  if (value.includes("geograph")) {
    return "Geography";
  }

  if (
    value.includes("history") ||
    value.includes("culture") ||
    value.includes("heritage")
  ) {
    return "History & Culture";
  }

  if (
    value.includes("scheme") ||
    value.includes("programme") ||
    value.includes("program")
  ) {
    return "Government Schemes";
  }

  return "Polity & Governance";
}

function normalizePaper(paper) {
  const value = cleanText(paper)
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace("GENERALSTUDIES", "GS");

  const paperMap = {
    PRELIMS: "Prelims",
    GS1: "GS-1",
    "GS-1": "GS-1",
    GS2: "GS-2",
    "GS-2": "GS-2",
    GS3: "GS-3",
    "GS-3": "GS-3",
    GS4: "GS-4",
    "GS-4": "GS-4",
    ESSAY: "Essay",
  };

  return paperMap[value] || "Prelims";
}

function validateEvaluation(result) {
  if (!result || typeof result !== "object") {
    throw new Error("Gemini returned an invalid evaluation.");
  }

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

function parseResponse(response) {
  const text = response?.text?.trim();

  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  const cleanedText = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  return validateEvaluation(JSON.parse(cleanedText));
}

function createEvaluationPrompt(title, description) {
  return `
You are a senior UPSC and State PCS current-affairs editor for CurrentPulse AI.

Evaluate whether the following news deserves a full examination-focused article.

NEWS TITLE

${title}

NEWS DESCRIPTION

${description || "No description was supplied."}

APPROVED CATEGORIES

${VALID_CATEGORIES.map((category) => `- ${category}`).join("\n")}

APPROVED PAPERS

${VALID_PAPERS.map((paper) => `- ${paper}`).join("\n")}

EVALUATION RULES

1. Mark relevant as true only when the story has genuine examination value.
2. Consider governance, Constitution, judiciary, economy, environment,
   science, technology, defence, security, international relations,
   government schemes, geography, history, culture and major social issues.
3. Ignore celebrity gossip, entertainment promotions, routine sports results,
   local crime without wider significance, advertisements and clickbait.
4. Importance must be an integer from 1 to 10.
5. Select exactly one approved category.
6. Select exactly one approved paper.
7. Give a short and specific reason.
8. Return between three and eight keywords.
9. Do not invent facts beyond the supplied title and description.
10. Return only the required JSON object.
`;
}

async function callGemini(model, prompt) {
  const config = {
    responseMimeType: "application/json",
    responseSchema: evaluationSchema,
  };

  if (!model.startsWith("gemini-3")) {
    config.temperature = 0.1;
  }

  const timeoutMs = 45000;

  console.log(
    `[News evaluation] Sending request to ${model}`
  );

  const geminiRequest = ai.models.generateContent({
    model,
    contents: prompt,
    config,
  });

  const timeoutRequest = new Promise((_, reject) => {
    setTimeout(() => {
      reject(
        new Error(
          `${model} timed out after ${timeoutMs / 1000} seconds`
        )
      );
    }, timeoutMs);
  });

  const response = await Promise.race([
    geminiRequest,
    timeoutRequest,
  ]);

  console.log(
    `[News evaluation] Response received from ${model}`
  );

  return parseResponse(response);
}
export async function evaluateNews(title, description = "") {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is missing from .env.local.");
  }

  const cleanedTitle = cleanText(title);
  const cleanedDescription = cleanText(description);

  if (!cleanedTitle) {
    throw new Error("News title is required.");
  }

  const prompt = createEvaluationPrompt(
    cleanedTitle,
    cleanedDescription
  );

  let lastError;

  for (const model of MODELS) {
    try {
      console.log(`[News evaluation] Trying ${model}`);

      const evaluation = await callGemini(model, prompt);

      console.log(
        `[News evaluation] Completed with ${model}`
      );

      return evaluation;
    } catch (error) {
      lastError = error;

      console.error(
        `[News evaluation] ${model} failed:`,
        error?.message || error
      );
    }
  }

  throw new Error(
    `News evaluation failed with all Gemini models. ${
      lastError?.message || "Please try again."
    }`
  );
}