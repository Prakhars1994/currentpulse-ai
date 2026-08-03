import { createHash } from "node:crypto";
import { Type } from "@google/genai";

import { generateWithRouter } from "@/lib/ai/router";

const MODELS = [
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
];
const TARGET_QUESTIONS = 12;
const MINIMUM_STORED_QUESTIONS = 10;
const VALID_DIFFICULTIES = new Set(["Easy", "Moderate", "Difficult"]);

const quizSchema = {
  type: Type.OBJECT,
  properties: {
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          sourceArticleId: { type: Type.INTEGER },
          prompt: { type: Type.STRING },
          options: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          correctIndex: { type: Type.INTEGER },
          explanation: { type: Type.STRING },
          difficulty: { type: Type.STRING },
        },
        required: [
          "sourceArticleId",
          "prompt",
          "options",
          "correctIndex",
          "explanation",
          "difficulty",
        ],
      },
    },
  },
  required: ["questions"],
};

function cleanText(value = "", maximum = 2400) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function indiaDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function parseJsonResponse(response) {
  const raw = response?.text?.trim();
  if (!raw) throw new Error("Quiz AI returned an empty response.");

  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed?.questions)) {
    throw new Error("Quiz AI did not return a questions array.");
  }
  return parsed.questions;
}

function isMetaQuestion(prompt) {
  const value = prompt.toLowerCase();
  return [
    "currentpulse",
    "which category",
    "mapped to which",
    "which gs paper",
    "source article",
    "article title",
    "headline",
  ].some((term) => value.includes(term));
}

const GROUNDING_STOP_WORDS = new Set([
  "about", "according", "article", "consider", "correct", "following", "given",
  "incorrect", "india", "only", "question", "regarding", "statement", "statements",
  "their", "these", "which", "with",
]);

function groundingTokens(value = "") {
  return cleanText(value, 9000)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 4 && !GROUNDING_STOP_WORDS.has(word));
}

function isGroundedInSource(prompt, explanation, source) {
  const sourceTokens = new Set(
    groundingTokens(`${source.title} ${source.why_news} ${source.prelims} ${source.mains}`)
  );
  const questionTokens = new Set(groundingTokens(`${prompt} ${explanation}`));
  const shared = [...questionTokens].filter((token) => sourceTokens.has(token));
  const titleTokens = new Set(groundingTokens(source.title));
  const titleOverlap = shared.filter((token) => titleTokens.has(token)).length;
  return shared.length >= 4 && titleOverlap >= 1;
}

function isUpscStatementFormat(prompt) {
  return (
    /consider the following statements|statement\s+(?:i|1)|how many of the above|pairs? given above|correctly matched/i.test(prompt) ||
    (/\b1[.)]\s/.test(prompt) && /\b2[.)]\s/.test(prompt))
  );
}

function validateQuestions(rawQuestions, articles, quizDate, provider) {
  const byId = new Map(articles.map((article) => [Number(article.id), article]));
  const seen = new Set();
  const validated = [];

  for (const raw of rawQuestions) {
    const sourceArticleId = Number(raw?.sourceArticleId);
    const source = byId.get(sourceArticleId);
    const prompt = cleanText(raw?.prompt, 1200);
    const options = Array.isArray(raw?.options)
      ? raw.options.map((option) => cleanText(option, 500))
      : [];
    const correctIndex = Number(raw?.correctIndex);
    const explanation = cleanText(raw?.explanation, 1800);
    const difficulty = VALID_DIFFICULTIES.has(raw?.difficulty)
      ? raw.difficulty
      : "Moderate";

    if (!source || prompt.length < 55 || isMetaQuestion(prompt)) continue;
    if (options.length !== 4 || options.some((option) => option.length < 1)) continue;
    if (new Set(options.map((option) => option.toLowerCase())).size !== 4) continue;
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) continue;
    if (explanation.length < 90) continue;
    if (!isGroundedInSource(prompt, explanation, source)) continue;

    const questionHash = createHash("sha256")
      .update(prompt.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim())
      .digest("hex");
    if (seen.has(questionHash)) continue;
    seen.add(questionHash);

    validated.push({
      quiz_date: quizDate,
      prompt,
      options,
      correct_index: correctIndex,
      explanation,
      difficulty,
      category: source.category || null,
      paper: "Prelims",
      source_article_id: sourceArticleId,
      source_slug: source.slug,
      source_title: source.title,
      question_hash: questionHash,
      generation_provider: provider,
      updated_at: new Date().toISOString(),
    });

    if (validated.length >= TARGET_QUESTIONS) break;
  }

  if (validated.length < MINIMUM_STORED_QUESTIONS) {
    throw new Error(
      `Quiz quality validation retained only ${validated.length} questions; at least ${MINIMUM_STORED_QUESTIONS} are required.`
    );
  }


  const statementCount = validated.filter((item) => isUpscStatementFormat(item.prompt)).length;
  if (statementCount < Math.min(9, validated.length - 2)) {
    throw new Error(
      `Quiz quality validation found only ${statementCount} UPSC statement/pair questions.`
    );
  }

  const answerDistribution = [0, 1, 2, 3].map(
    (index) => validated.filter((item) => item.correct_index === index).length
  );
  if (answerDistribution.some((count) => count < 2)) {
    throw new Error(
      `Quiz answer positions are unbalanced (${answerDistribution.join(", ")}).`
    );
  }

  const difficultyCounts = validated.reduce(
    (counts, item) => ({ ...counts, [item.difficulty]: counts[item.difficulty] + 1 }),
    { Easy: 0, Moderate: 0, Difficult: 0 }
  );
  if (
    difficultyCounts.Easy < 1 ||
    difficultyCounts.Moderate < 5 ||
    difficultyCounts.Difficult < 2
  ) {
    throw new Error(
      `Quiz difficulty mix is invalid (${difficultyCounts.Easy}/${difficultyCounts.Moderate}/${difficultyCounts.Difficult}).`
    );
  }
  return validated;
}

function sourcePayload(articles) {
  return articles.map((article) => ({
    id: article.id,
    title: cleanText(article.title, 240),
    category: cleanText(article.category, 100),
    whyInNews: cleanText(article.why_news, 900),
    prelimsFacts: cleanText(article.prelims, 2200),
    mainsContext: cleanText(article.mains, 900),
  }));
}

function buildPrompt(articles, quizDate) {
  return `You are a senior UPSC Civil Services Prelims question setter.

Create exactly ${TARGET_QUESTIONS} high-quality current-affairs MCQs for ${quizDate}, using ONLY the verified material in SOURCE_ARTICLES below.

NON-NEGOTIABLE QUALITY RULES:
1. Questions must test UPSC-relevant knowledge, conceptual linkage and careful statement evaluation. Never ask the article title, website category, GS-paper mapping, publisher or headline.
2. At least 9 questions must use authentic UPSC formats such as "Consider the following statements", pairs/matching, or statement I/statement II. The remaining questions may test a precise institution, mechanism or implication.
3. Give exactly four mutually exclusive, plausible options. Avoid joke options, obvious filler and duplicate meanings.
4. Use only facts present in the corresponding source article. Do not introduce names, dates, statistics, provisions or claims absent from that article.
5. Each explanation must identify why the correct option is correct and, for statement questions, explicitly assess every statement.
6. Balance correctIndex across 0, 1, 2 and 3. Use difficulty distribution: 2 Easy, 7 Moderate, 3 Difficult.
7. sourceArticleId must exactly match the article used. Do not mix unsupported facts from different articles into one question.
8. Do not use vague phrasing such as "according to the article" or "recent headline". Make each question independently meaningful.

Return JSON only in this structure:
{"questions":[{"sourceArticleId":123,"prompt":"...","options":["...","...","...","..."],"correctIndex":0,"explanation":"...","difficulty":"Moderate"}]}

SOURCE_ARTICLES:
${JSON.stringify(sourcePayload(articles))}`;
}

async function requestQuiz(articles, quizDate) {
  const prompt = buildPrompt(articles, quizDate);
  let lastError;

  for (const model of MODELS) {
    try {
      const response = await generateWithRouter({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: quizSchema,
          maxOutputTokens: 10000,
          temperature: 0.15,
        },
      });
      const provider = response?.provider || `gemini:${model}`;
      return {
        questions: validateQuestions(parseJsonResponse(response), articles, quizDate, provider),
        provider,
      };
    } catch (error) {
      lastError = error;
      console.error(`[Daily quiz] ${model} failed:`, error?.message || error);
    }
  }

  throw lastError || new Error("All quiz AI models failed.");
}

export async function generateDailyQuiz(supabase, { force = false } = {}) {
  const quizDate = indiaDate();

  if (!force) {
    const { count, error: countError } = await supabase
      .from("quiz_questions")
      .select("id", { count: "exact", head: true })
      .eq("quiz_date", quizDate);
    if (countError) throw new Error(`Quiz count failed: ${countError.message}`);
    if ((count || 0) >= MINIMUM_STORED_QUESTIONS) {
      return { generated: false, quizDate, count, reason: "already_ready" };
    }
  }

  const { data: articles, error: articlesError } = await supabase
    .from("articles")
    .select("id,title,slug,category,why_news,prelims,mains,created_at")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(24);

  if (articlesError) throw new Error(`Quiz source fetch failed: ${articlesError.message}`);
  const usable = (articles || []).filter(
    (article) => article.title && article.slug && (article.prelims || article.why_news)
  );
  if (usable.length < 6) {
    throw new Error("At least six detailed published articles are required for a daily quiz.");
  }

  const generated = await requestQuiz(usable, quizDate);
  const rows = generated.questions;

  if (force) {
    const { error: deleteError } = await supabase
      .from("quiz_questions")
      .delete()
      .eq("quiz_date", quizDate);
    if (deleteError) throw new Error(`Old quiz replacement failed: ${deleteError.message}`);
  }

  const { data: inserted, error: insertError } = await supabase
    .from("quiz_questions")
    .upsert(rows, { onConflict: "quiz_date,question_hash", ignoreDuplicates: true })
    .select("id");
  if (insertError) throw new Error(`Quiz save failed: ${insertError.message}`);

  return {
    generated: true,
    quizDate,
    count: inserted?.length || rows.length,
    provider: generated.provider,
  };
}
