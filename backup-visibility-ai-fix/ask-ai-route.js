import axios from "axios";
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const { question, mode } = await req.json();

    let instruction = "";

    switch (mode) {
      case "Explain Topic":
        instruction =
          "Explain the topic in simple language with clear headings and bullet points. Avoid markdown tables.";
        break;

      case "Mains Answer":
        instruction =
          "Write a UPSC GS Mains answer with Introduction, Body, Conclusion, Examples and Way Forward.";
        break;

      case "Prelims Facts":
        instruction =
          "Provide important UPSC prelims facts in short bullet points.";
        break;

      case "MCQs":
        instruction =
          "Generate 5 UPSC Prelims MCQs with four options, answer and explanation.";
        break;

      default:
        instruction =
          "Answer in a detailed and easy-to-understand format.";
    }

    const prompt = `
You are CurrentPulse AI.

Question:
${question}

Instructions:
${instruction}

Rules:
- Use simple English.
- Use proper headings.
- Use bullet points.
- Do NOT use markdown tables.
- Do NOT use HTML.
- Keep formatting clean.
`;

    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "nvidia/nemotron-3-ultra-550b-a55b:free",
        messages: [
          {
            role: "system",
            content:
              "You are an expert UPSC mentor and current affairs analyst.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.5,
        max_tokens: 800,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:3000",
          "X-Title": "CurrentPulse AI",
        },
      }
    );

    console.log("OpenRouter Response:");
    console.log(JSON.stringify(response.data, null, 2));

    if (
      !response.data ||
      !response.data.choices ||
      response.data.choices.length === 0
    ) {
      return NextResponse.json({
        answer: "AI Error: No response received from OpenRouter.",
      });
    }

    const answer =
      response.data.choices?.[0]?.message?.content ||
      "No answer generated.";

    return NextResponse.json({
      answer,
    });
  } catch (error) {
    console.error("OpenRouter Error:");
    console.error(error.response?.data || error.message);

    return NextResponse.json({
      answer:
        "AI Error: " +
        (error.response?.data?.error?.message ||
          error.message ||
          "Unknown error"),
    });
  }
}