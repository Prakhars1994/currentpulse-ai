import { NextResponse } from "next/server";
import { generateWithRouter } from "@/lib/ai/router";
import { createServerSupabase } from "@/lib/supabase-server";
import { SITE_URL } from "@/lib/siteUrl";
import { isPublishedArticleSafe } from "@/lib/editorial/publicationSafety";
import { isDisplayWorthyNews } from "@/lib/news/newsQuality";

const MODELS = ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite"];
const STOP = new Set(["what","when","where","which","why","how","about","with","from","this","that","the","and","for","are","was","were","has","have","explain","upsc","current","affairs"]);

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
  const found = new Map();

  for (const term of terms.slice(0, 4)) {
    const safe = term.replace(/[^a-z0-9-]/g, "");
    if (!safe) continue;
    const { data, error } = await client.from("articles")
      .select("id,title,slug,category,why_news,static_foundation,data_examples,prelims,mains,updated_at,article_sources(source_kind)")
      .eq("status", "published")
      .or(`title.ilike.%${safe}%,why_news.ilike.%${safe}%,static_foundation.ilike.%${safe}%`)
      .order("updated_at", { ascending: false })
      .limit(8);
    if (error) {
      console.warn("[Ask AI] Retrieval failed:", error.message);
      continue;
    }
    for (const article of data || []) found.set(article.id, article);
  }

  return [...found.values()].filter((article) => {
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
    const cleanQuestion = String(question || "").trim();
    if (!cleanQuestion) return NextResponse.json({ answer: "Please enter a question." }, { status: 400 });

    const articles = await retrieveArticles(cleanQuestion).catch((error) => {
      console.error("[Ask AI] Retrieval error:", error);
      return [];
    });
    const context = buildContext(articles);

    if (!process.env.GEMINI_API_KEY && !process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({ answer: groundedFallback(cleanQuestion, mode, articles), groundedFallback: true, sources: articles.map((a) => ({ title: a.title, url: `${SITE_URL}${articlePath(a)}` })) });
    }

    const prompt = `You are CurrentPulse AI, an evidence-first UPSC mentor and current-affairs assistant.\n\nUSER QUESTION:\n${cleanQuestion}\n\nTASK:\n${buildInstruction(mode)}\n\nRETRIEVED CURRENTPULSE MATERIAL:\n${context || "No matching CurrentPulse article was retrieved."}\n\nRULES:\n- For current events, office-holders, recent data, dates, rankings and policies, use only the retrieved material.\n- Never fill a current fact from model memory. If the material does not support a current claim, say it is not verified in the retrieved sources.\n- Stable textbook concepts may be explained when certain, but do not attach invented current numbers to them.\n- Prefer short bullets and bold high-value facts.\n- Cite relevant CurrentPulse links at the end under 'Sources'.\n- No HTML.`;

    let lastError;
    for (const model of MODELS) {
      try {
        const response = await generateWithRouter({ model, contents: prompt, config: { temperature: model.startsWith("gemini-3") ? undefined : 0.25, maxOutputTokens: 1800 } });
        const answer = response?.text?.trim();
        if (answer) return NextResponse.json({ answer, provider: response.provider || "gemini", model: response.model || model, sources: articles.map((a) => ({ title: a.title, url: `${SITE_URL}${articlePath(a)}` })) });
        lastError = new Error(`${model} returned an empty response.`);
      } catch (error) {
        lastError = error;
        console.error(`[Ask AI] ${model} failed:`, error?.message || error);
        if (!isRetryable(error)) break;
      }
    }

    if (articles.length) return NextResponse.json({ answer: groundedFallback(cleanQuestion, mode, articles), groundedFallback: true, error: lastError?.message || "AI providers unavailable", sources: articles.map((a) => ({ title: a.title, url: `${SITE_URL}${articlePath(a)}` })) });
    return NextResponse.json({ answer: "CurrentPulse AI could not verify enough material for this question right now. Please try a more specific topic shortly.", error: lastError?.message || "AI providers unavailable" }, { status: 503 });
  } catch (error) {
    console.error("Ask AI route error:", error);
    return NextResponse.json({ answer: "Something went wrong while preparing the answer." }, { status: 500 });
  }
}
