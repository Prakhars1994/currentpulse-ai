import { GoogleGenAI } from "@google/genai";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "openrouter/free";

function getGeminiClient() {
  return process.env.GEMINI_API_KEY
    ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
    : null;
}

function extractOpenRouterText(payload) {
  const content = payload?.choices?.[0]?.message?.content;

  if (typeof content === "string" && content.trim()) return content.trim();

  if (Array.isArray(content)) {
    const text = content
      .map((part) => (typeof part === "string" ? part : part?.text || ""))
      .join("")
      .trim();
    if (text) return text;
  }

  throw new Error(
    payload?.error?.message || "OpenRouter returned an empty response."
  );
}

async function generateWithOpenRouter(contents, config = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);

  try {
    const requestBody = {
      model: OPENROUTER_MODEL,
      messages: [
        {
          role: "user",
          content:
            typeof contents === "string" ? contents : JSON.stringify(contents),
        },
      ],
      temperature: typeof config.temperature === "number" ? config.temperature : 0.1,
      max_tokens: Number(config.maxOutputTokens) || 7000,
    };

    if (config.responseMimeType === "application/json") {
      requestBody.response_format = { type: "json_object" };
      requestBody.plugins = [{ id: "response-healing" }];
    }

    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer":
          process.env.NEXT_PUBLIC_SITE_URL || "https://currentpulse-ai.vercel.app",
        "X-OpenRouter-Title": "CurrentPulse AI",
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        `OpenRouter failed (${response.status}): ${
          payload?.error?.message || response.statusText
        }`
      );
    }

    return {
      text: extractOpenRouterText(payload),
      provider: "openrouter",
      model: payload?.model || OPENROUTER_MODEL,
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("OpenRouter request timed out after 90 seconds.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateWithRouter({ model, contents, config }) {
  const gemini = getGeminiClient();
  let geminiError = null;

  if (gemini) {
    try {
      return await gemini.models.generateContent({ model, contents, config });
    } catch (error) {
      geminiError = error;
      console.warn(
        `[AI router] Gemini ${model} unavailable; trying OpenRouter:`,
        error?.message || error
      );
    }
  }

  if (process.env.OPENROUTER_API_KEY) {
    return generateWithOpenRouter(contents, config);
  }

  if (geminiError) throw geminiError;

  throw new Error(
    "No AI provider is configured. Add GEMINI_API_KEY or OPENROUTER_API_KEY."
  );
}
