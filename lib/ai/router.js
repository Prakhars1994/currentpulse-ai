import { GoogleGenAI } from "@google/genai";

const gemini = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export async function generateWithRouter({ model, contents, config }) {
  try {
    return await gemini.models.generateContent({
      model,
      contents,
      config,
    });
  } catch (error) {
    const message = String(error?.message || "");
    const quotaExceeded =
      message.includes("RESOURCE_EXHAUSTED") ||
      message.includes("429") ||
      message.toLowerCase().includes("quota");

    if (!quotaExceeded || !process.env.OPENROUTER_API_KEY) {
      throw error;
    }

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "deepseek/deepseek-chat-v3",
          messages: [{
            role: "user",
            content: typeof contents === "string"
              ? contents
              : JSON.stringify(contents)
          }]
        })
      }
    );

    if (!response.ok) {
      throw new Error(`OpenRouter failed: ${response.status}`);
    }

    return await response.json();
  }
}
