import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

const MODELS = [
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
];

function buildInstruction(mode) {
  switch (mode) {
    case "Explain Topic":
      return "Explain the topic in simple language with clear headings and bullet points. Avoid tables unless essential.";
    case "Mains Answer":
      return "Write a UPSC GS Mains answer with Introduction, Body, balanced analysis, examples, Way Forward and Conclusion.";
    case "Prelims Facts":
      return "Provide concise, high-value UPSC Prelims facts in bullet points, including dates, institutions, provisions and data where relevant.";
    case "MCQs":
      return "Generate 5 UPSC Prelims MCQs with four options, the correct answer and a short explanation for each.";
    default:
      return "Answer accurately in a detailed, easy-to-understand format with useful headings and bullet points.";
  }
}

function isRetryable(error) {
  const status = Number(error?.status);
  const message = String(error?.message || "").toLowerCase();

  return (
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    message.includes("resource_exhausted") ||
    message.includes("rate limit") ||
    message.includes("unavailable") ||
    message.includes("high demand")
  );
}

export async function POST(request) {
  try {
    const { question, mode = "Explain Topic" } = await request.json();
    const cleanQuestion = String(question || "").trim();

    if (!cleanQuestion) {
      return NextResponse.json(
        { answer: "Please enter a question." },
        { status: 400 }
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { answer: "AI service is not configured. GEMINI_API_KEY is missing." },
        { status: 503 }
      );
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const prompt = `You are CurrentPulse AI, an expert UPSC mentor and current-affairs analyst.\n\nUser question:\n${cleanQuestion}\n\nTask:\n${buildInstruction(mode)}\n\nRules:\n- Use clear English.\n- Use Markdown headings and bullet points.\n- Be factual and avoid inventing data.\n- Clearly state uncertainty when information is uncertain.\n- Keep the answer focused on UPSC usefulness.\n- Do not output HTML.`;

    let lastError;

    for (const model of MODELS) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            temperature: model.startsWith("gemini-3") ? undefined : 0.4,
            maxOutputTokens: 1400,
          },
        });

        const answer = response?.text?.trim();

        if (answer) {
          return NextResponse.json({ answer, provider: "gemini", model });
        }

        lastError = new Error(`${model} returned an empty response.`);
      } catch (error) {
        lastError = error;
        console.error(`[Ask AI] ${model} failed:`, error?.message || error);

        if (!isRetryable(error)) {
          break;
        }
      }
    }

    return NextResponse.json(
      {
        answer:
          "CurrentPulse AI is temporarily unavailable. Please try again shortly.",
        error: lastError?.message || "All Gemini models failed.",
      },
      { status: 503 }
    );
  } catch (error) {
    console.error("Ask AI route error:", error);

    return NextResponse.json(
      { answer: "Something went wrong while generating the answer." },
      { status: 500 }
    );
  }
}
