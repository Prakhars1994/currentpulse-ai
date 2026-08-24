import { NextResponse } from "next/server";
import { generateWithRouter, getConfiguredAiProviders } from "@/lib/ai/router";
import { createServerSupabase } from "@/lib/supabase-server";
import { SITE_URL } from "@/lib/siteUrl";
import { isPublishedArticleSafe } from "@/lib/editorial/publicationSafety";
import { isDisplayWorthyNews } from "@/lib/news/newsQuality";

const MODELS = ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite"];
const STOP = new Set(["what","when","where","which","why","how","about","with","from","this","that","the","and","for","are","was","were","has","have","explain","upsc","current","affairs"]);
const ANSWER_CACHE_TTL_MS = 5 * 60 * 1000;
const CLIENT_WINDOW_MS = 10 * 60 * 1000;
const MAX_UNCACHED_QUESTIONS_PER_WINDOW = 3;
const answerCache = globalThis.__currentPulseAnswerCache || new Map();
globalThis.__currentPulseAnswerCache = answerCache;
const clientQuestionWindows = globalThis.__currentPulseQuestionWindows || new Map();
globalThis.__currentPulseQuestionWindows = clientQuestionWindows;

function answerCacheKey(question, mode) {
  return `${String(mode || "Explain Topic").trim().toLowerCase()}|${String(question || "").trim().toLowerCase().replace(/\s+/g, " ")}`;
}

function readAnswerCache(key) {
  const cached = answerCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.createdAt > ANSWER_CACHE_TTL_MS) {
    answerCache.delete(key);
    return null;
  }
  return cached.payload;
}

function writeAnswerCache(key, payload) {
  answerCache.set(key, { createdAt: Date.now(), payload });
  if (answerCache.size > 250) {
    const oldest = answerCache.keys().next().value;
    if (oldest) answerCache.delete(oldest);
  }
  return payload;
}

function allowUncachedQuestion(request) {
  const client = request.headers.get("cf-connecting-ip") || "unknown";
  const now = Date.now();
  const window = (clientQuestionWindows.get(client) || []).filter(
    (timestamp) => now - timestamp < CLIENT_WINDOW_MS
  );

  if (window.length >= MAX_UNCACHED_QUESTIONS_PER_WINDOW) {
    clientQuestionWindows.set(client, window);
    return false;
  }

  window.push(now);
  clientQuestionWindows.set(client, window);

  if (clientQuestionWindows.size > 5000) {
    for (const [key, timestamps] of clientQuestionWindows) {
      if (!timestamps.some((timestamp) => now - timestamp < CLIENT_WINDOW_MS)) {
        clientQuestionWindows.delete(key);
      }
    }
  }

  return true;
}

function buildInstruction(mode) {
  switch (mode) {
    case "Mains Answer": return "Write a concise UPSC GS Mains answer with Introduction, analytical Body, source-backed examples, Way Forward and Conclusion.";
    case "Prelims Facts": return "Give 6-10 concise high-value Prelims facts. Bold decisive names, dates, provisions and data. Do not invent a fact.";
    case "MCQs": return "Generate 5 UPSC-style MCQs grounded in the supplied CurrentPulse material, with four options, answer and short explanation.";
    default: return "Explain clearly with short headings and bullets. Separate verified current facts from stable background knowledge.";
  }
}

function isRetryable(error) {
  const status = Number(error?.status);
  const message = String(error?.message || "").toLowerCase();
  return status === 429 || status >= 500 || message.includes("resource_exhausted") || message.includes("rate limit") || message.includes("unavailable") || message.includes("high demand") || message.includes("timeout");
}

function keywords(question = "") {
  return [...new Set(String(question).toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter((word) => word.length >= 4 && !STOP.has(word)))].sort((a,b) => b.length-a.length).slice(0,5);
}

function isCoaching(article = {}) {
  return (article.article_sources || []).some((source) => source?.source_kind === "coaching");
}

async function retrieveArticles(question) {
  const terms = keywords(question);
  if (!terms.length) return [];
  const client = createServerSupabase();
  const safeTerms = terms.slice(0, 4).map((term) => term.replace(/[^a-z0-9-]/g, "")).filter(Boolean);
  if (!safeTerms.length) return [];

  // One PostgREST query instead of one query per keyword. This keeps Ask AI's
  // retrieval cost bounded even when many readers arrive at once.
  const orFilter = safeTerms.flatMap((term) => [
    `title.ilike.%${term}%`,
    `why_news.ilike.%${term}%`,
    `static_foundation.ilike.%${term}%`,
  ]).join(",");

  const { data, error } = await client.from("articles")
    .select("id,title,slug,category,why_news,static_foundation,data_examples,prelims,mains,updated_at,article_sources(source_kind)")
    .eq("status", "published")
    .or(orFilter)
    .order("updated_at", { ascending: false })
    .limit(24);

  if (error) {
    console.warn("[Ask AI] Retrieval failed:", error.message);
    return [];
  }

  return (data || []).filter((article) => {
    const stream = isCoaching(article) ? "coverage" : "news";
    return stream === "news"
      ? isDisplayWorthyNews(article)
      : isPublishedArticleSafe(article, { stream });
  }).map((article) => {
    const haystack = `${article.title} ${article.why_news || ""}`.toLowerCase();
    const score = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 2 : 0) + (String(article.title).toLowerCase().includes(term) ? 2 : 0), 0);
    return { ...article, _score: score };
  }).sort((a,b) => b._score-a._score).slice(0,5);
}

function articlePath(article) {
  return `${isCoaching(article) ? "/current-affairs" : "/news"}/${article.slug}`;
}

function buildContext(articles) {
  return articles.map((article, index) => `SOURCE ${index + 1}: ${article.title}\nURL: ${SITE_URL}${articlePath(article)}\nUPDATED: ${article.updated_at || "not supplied"}\nWHY/LEAD: ${String(article.why_news || "").slice(0,1200)}\nSTATIC/CONTEXT: ${String(article.static_foundation || "").slice(0,1000)}\nDATA/EXAMPLES: ${String(article.data_examples || "").slice(0,1200)}\nPRELIMS: ${String(article.prelims || "").slice(0,900)}\nMAINS: ${String(article.mains || "").slice(0,1200)}`).join("\n\n---\n\n");
}

function groundedFallback(question, mode, articles) {
  if (!articles.length) return "I could not find enough matching CurrentPulse material to answer this reliably right now.";
  const lead = mode === "Prelims Facts" ? "### Quick facts from CurrentPulse" : mode === "Mains Answer" ? "### CurrentPulse source brief" : "### What CurrentPulse has on this topic";
  const blocks = articles.slice(0,4).map((article) => {
    const preferred = mode === "Mains Answer" ? article.mains : mode === "Prelims Facts" ? article.prelims : article.why_news;
    const snippet = String(preferred || article.why_news || article.static_foundation || "").replace(/#{1,6}\s*/g, "").trim().slice(0,700);
    return `**${article.title}**\n\n${snippet || "Open the source article for details."}\n\n[Read CurrentPulse source](${SITE_URL}${articlePath(article)})`;
  });
  return `${lead}\n\n${blocks.join("\n\n---\n\n")}\n\n> AI generation was unavailable, so this response uses retrieved CurrentPulse material instead of inventing an answer.`;
}

export async function POST(request) {
  try {
    const { question, mode = "Explain Topic" } = await request.json();
    const cleanQuestion = String(question || "").trim().slice(0, 1200);
    if (!cleanQuestion) return NextResponse.json({ answer: "Please enter a question." }, { status: 400 });

    const cacheKey = answerCacheKey(cleanQuestion, mode);
    const cachedPayload = readAnswerCache(cacheKey);
    if (cachedPayload) return NextResponse.json({ ...cachedPayload, cached: true });

    if (!allowUncachedQuestion(request)) {
      return NextResponse.json(
        {
          answer: "To keep CurrentPulse AI available for everyone, please wait a few minutes before asking another new question.",
        },
        { status: 429, headers: { "Retry-After": "600" } }
      );
    }

    const articles = await retrieveArticles(cleanQuestion).catch((error) => {
      console.error("[Ask AI] Retrieval error:", error);
      return [];
    });
    const context = buildContext(articles);

    if (!getConfiguredAiProviders().length) {
      return NextResponse.json(writeAnswerCache(cacheKey, { answer: groundedFallback(cleanQuestion, mode, articles), groundedFallback: true, sources: articles.map((a) => ({ title: a.title, url: `${SITE_URL}${articlePath(a)}` })) }));
    }

    const prompt = `You are CurrentPulse AI, an evidence-first UPSC mentor and current-affairs assistant.\n\nUSER QUESTION:\n${cleanQuestion}\n\nTASK:\n${buildInstruction(mode)}\n\nRETRIEVED CURRENTPULSE MATERIAL:\n${context || "No matching CurrentPulse article was retrieved."}\n\nRULES:\n- For current events, office-holders, recent data, dates, rankings and policies, use only the retrieved material.\n- Never fill a current fact from model memory. If the material does not support a current claim, say it is not verified in the retrieved sources.\n- Stable textbook concepts may be explained when certain, but do not attach invented current numbers to them.\n- Prefer short bullets and bold high-value facts.\n- Cite relevant CurrentPulse links at the end under 'Sources'.\n- No HTML.`;

    let lastError;
    for (const model of MODELS) {
      try {
        const response = await generateWithRouter({ model, contents: prompt, config: { temperature: model.startsWith("gemini-3") ? undefined : 0.25, maxOutputTokens: 1800 } });
        const answer = response?.text?.trim();
        if (answer) return NextResponse.json(writeAnswerCache(cacheKey, { answer, provider: response.provider || "gemini", model: response.model || model, sources: articles.map((a) => ({ title: a.title, url: `${SITE_URL}${articlePath(a)}` })) }));
        lastError = new Error(`${model} returned an empty response.`);
      } catch (error) {
        lastError = error;
        console.error(`[Ask AI] ${model} failed:`, error?.message || error);
        if (!isRetryable(error)) break;
      }
    }

    if (articles.length) return NextResponse.json(writeAnswerCache(cacheKey, { answer: groundedFallback(cleanQuestion, mode, articles), groundedFallback: true, error: lastError?.message || "AI providers unavailable", sources: articles.map((a) => ({ title: a.title, url: `${SITE_URL}${articlePath(a)}` })) }));
    return NextResponse.json({ answer: "CurrentPulse AI could not verify enough material for this question right now. Please try a more specific topic shortly.", error: lastError?.message || "AI providers unavailable" }, { status: 503 });
  } catch (error) {
    console.error("Ask AI route error:", error);
    return NextResponse.json({ answer: "Something went wrong while preparing the answer." }, { status: 500 });
  }
}
