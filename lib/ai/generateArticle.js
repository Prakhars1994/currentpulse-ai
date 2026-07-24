import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const MODELS = [
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-flash-lite-latest",
];

const articleSchema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "A specific and factual article title.",
    },
    category: {
      type: Type.STRING,
      description: "The most appropriate UPSC current-affairs category.",
    },
    paper: {
      type: Type.STRING,
      description: "One of GS-1, GS-2, GS-3, GS-4 or Prelims.",
    },
    why_news: {
      type: Type.STRING,
      description: "A concise explanation of why the topic is in the news.",
    },
    prelims: {
      type: Type.STRING,
      description: "Important factual points useful for UPSC Prelims.",
    },
    mains: {
      type: Type.STRING,
      description:
        "Mains analysis covering significance, challenges and way forward.",
    },
    question: {
      type: Type.STRING,
      description: "One relevant UPSC Mains-style question.",
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
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isTemporaryError(error) {
  const status = error?.status;
  const message = String(error?.message || "");

  return (
    status === 503 ||
    status === 429 ||
    message.includes('"code":503') ||
    message.includes('"code":429') ||
    message.includes("high demand") ||
    message.includes("UNAVAILABLE") ||
    message.includes("RESOURCE_EXHAUSTED")
  );
}

function isJsonError(error) {
  return (
    error instanceof SyntaxError ||
    String(error?.message || "").includes("JSON") ||
    String(error?.message || "").includes("property value")
  );
}

function validateArticle(article) {
  const requiredFields = [
    "title",
    "category",
    "paper",
    "why_news",
    "prelims",
    "mains",
    "question",
  ];

  for (const field of requiredFields) {
    if (
      typeof article?.[field] !== "string" ||
      !article[field].trim()
    ) {
      throw new Error(
        `Gemini returned an invalid or empty "${field}" field.`
      );
    }
  }

  return article;
}

async function callGemini(model, prompt) {
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: articleSchema,
      temperature: 0.2,
    },
  });

  const text = response.text?.trim();

  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  console.log("RAW GEMINI RESPONSE:");
  console.log(text);

  const cleanedText = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    const parsedArticle = JSON.parse(cleanedText);
    return validateArticle(parsedArticle);
  } catch (error) {
    console.error("Invalid Gemini JSON:", cleanedText);
    throw new Error(`Invalid JSON returned by Gemini: ${error.message}`);
  }
}

export async function generateArticle(sourceContent) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is missing from .env.local.");
  }

  if (!sourceContent?.trim()) {
    throw new Error("News content is required.");
  }

  const prompt = `
You are a senior UPSC current-affairs editor.

Create an accurate, clear and examination-focused article using only the
information supplied below.

Requirements:

- title: specific and factual
- category: choose the most appropriate UPSC category
- paper: use GS-1, GS-2, GS-3, GS-4 or Prelims
- why_news: explain the immediate development
- prelims: provide important factual points
- mains: provide significance, challenges and way forward
- question: write one relevant UPSC Mains-style question
- Do not invent dates, statistics, institutions or claims
- If the source lacks a fact, do not fabricate it
- Follow the supplied JSON schema exactly

SOURCE CONTENT:

${sourceContent.trim()}
`;

  let lastError;

  for (const model of MODELS) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        console.log(`Trying ${model}, attempt ${attempt}`);

        return await callGemini(model, prompt);
      } catch (error) {
        lastError = error;

        console.error(
          `${model}, attempt ${attempt} failed:`,
          error?.message || error
        );

        const retryable =
          isTemporaryError(error) ||
          isJsonError(error) ||
          String(error?.message || "").includes("Invalid JSON") ||
          String(error?.message || "").includes("empty response");

        if (!retryable) {
          throw error;
        }

        if (attempt < 3) {
          const delay = 2000 * 2 ** (attempt - 1);

          console.log(`Retrying in ${delay / 1000} seconds...`);
          await wait(delay);
        }
      }
    }
  }

  throw new Error(
    `All Gemini generation attempts failed. ${
      lastError?.message || "Please try again later."
    }`
  );
}