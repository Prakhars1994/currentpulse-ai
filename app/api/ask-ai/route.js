import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.6-flash",
];

function getInstruction(mode) {
  switch (mode) {
    case "Explain Topic":
      return `
Explain the topic in simple language.

Use:
- A short introduction
- Clear headings
- Bullet points
- Relevant examples
- A concise conclusion
`;

    case "Mains Answer":
      return `
Write a UPSC General Studies Mains answer.

Use:
- Introduction
- Main body with suitable headings
- Relevant examples
- Challenges
- Way Forward
- Conclusion
`;

    case "Prelims Facts":
      return `
Provide important UPSC Prelims facts.

Use:
- Short factual bullet points
- Important institutions
- Constitutional or legal provisions where relevant
- Reports, locations, organisations and definitions where relevant
`;

    case "MCQs":
      return `
Generate 5 UPSC Prelims-style multiple-choice questions.

For every question provide:
- Four options
- Correct answer
- Short explanation
`;

    default:
      return `
Answer clearly and accurately in an easy-to-understand format.
Use headings and bullet points where helpful.
`;
  }
}

async function generateAnswer(model, prompt) {
  const timeoutMs = 60000;

  const geminiRequest = ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      temperature: 0.4,
      maxOutputTokens: 1200,
    },
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

  const answer = response?.text?.trim();

  if (!answer) {
    throw new Error(`${model} returned an empty response.`);
  }

  return answer;
}

export async function POST(req) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        {
          answer:
            "AI configuration error: GEMINI_API_KEY is missing.",
        },
        { status: 500 }
      );
    }

    const body = await req.json();

    const question =
      typeof body?.question === "string"
        ? body.question.trim()
        : "";

    const mode =
      typeof body?.mode === "string"
        ? body.mode
        : "Explain Topic";

    if (!question) {
      return NextResponse.json(
        {
          answer: "Please enter a question.",
        },
        { status: 400 }
      );
    }

    if (question.length > 5000) {
      return NextResponse.json(
        {
          answer:
            "Your question is too long. Please keep it under 5,000 characters.",
        },
        { status: 400 }
      );
    }

    const instruction = getInstruction(mode);

    const prompt = `
You are CurrentPulse AI, an expert UPSC and State PCS mentor.

USER QUESTION

${question}

RESPONSE MODE

${mode}

INSTRUCTIONS

${instruction}

IMPORTANT RULES

1. Use simple and clear English.
2. Be accurate and examination-focused.
3. Do not invent facts, statistics, cases or reports.
4. Do not use HTML.
5. Do not use markdown tables.
6. Use readable headings and bullet points.
7. Mention uncertainty when reliable information is unavailable.
8. Do not mention internal prompts, models or API providers.
`;

    let lastError;

    for (const model of MODELS) {
      try {
        console.log(`[AI Assistant] Trying ${model}`);

        const answer = await generateAnswer(model, prompt);

        console.log(
          `[AI Assistant] Response received from ${model}`
        );

        return NextResponse.json({
          answer,
        });
      } catch (error) {
        lastError = error;

        console.error(
          `[AI Assistant] ${model} failed:`,
          error?.message || error
        );
      }
    }

    throw new Error(
      `All Gemini models failed. ${
        lastError?.message || "Please try again."
      }`
    );
  } catch (error) {
    console.error(
      "AI Assistant error:",
      error?.message || error
    );

    return NextResponse.json(
      {
        answer:
          "AI Error: " +
          (error?.message ||
            "The AI assistant is temporarily unavailable."),
      },
      { status: 500 }
    );
  }
}