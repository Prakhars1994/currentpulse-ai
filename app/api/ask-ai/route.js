import { NextResponse } from "next/server";
import { generateWithRouter, getConfiguredAiProviders } from "@/lib/ai/router";
import { createServerSupabase } from "@/lib/supabase-server";
import { SITE_URL } from "@/lib/siteUrl";
import { isPublishedArticleSafe } from "@/lib/editorial/publicationSafety";
import { isDisplayWorthyNews } from "@/lib/news/newsQuality";

const MODELS = ["gemini-3.6-flash", "gemini-3.5-flash-lite"];
const STOP = new Set(["what","when","where","which","why","how","about","with","from","this","that","the","and","for","are","was","were","has","have","explain","upsc","current","affairs"]);
const ANSWER_CACHE_TTL_MS = 30 * 60 * 1000;
const WIKI_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const GDELT_CACHE_TTL_MS = 30 * 60 * 1000;
const CLIENT_WINDOW_MS = 10 * 60 * 1000;
const MAX_UNCACHED_QUESTIONS_PER_WINDOW = 3;
const answerCache = globalThis.__currentPulseAnswerCache || new Map();
const sourceCache = globalThis.__currentPulseSourceCache || new Map();
const clientQuestionWindows = globalThis.__currentPulseQuestionWindows || new Map();
globalThis.__currentPulseAnswerCache = answerCache;
globalThis.__currentPulseSourceCache = sourceCache;
globalThis.__currentPulseQuestionWindows = clientQuestionWindows;

function normalize(value = "") { return String(value || "").trim().replace(/\s+/g, " "); }
function answerCacheKey(question, mode) { return `${normalize(mode).toLowerCase()}|${normalize(question).toLowerCase()}`; }
function readTimedCache(map, key, ttl) { const item = map.get(key); if (!item) return null; if (Date.now() - item.createdAt > ttl) { map.delete(key); return null; } return item.payload; }
function writeTimedCache(map, key, payload) { map.set(key, { createdAt: Date.now(), payload }); if (map.size > 300) map.delete(map.keys().next().value); return payload; }
function readAnswerCache(key) { return readTimedCache(answerCache, key, ANSWER_CACHE_TTL_MS); }
function writeAnswerCache(key, payload) { return writeTimedCache(answerCache, key, payload); }

function allowUncachedQuestion(request) {
  const client = request.headers.get("cf-connecting-ip") || "unknown";
  const now = Date.now();
  const window = (clientQuestionWindows.get(client) || []).filter((timestamp) => now - timestamp < CLIENT_WINDOW_MS);
  if (window.length >= MAX_UNCACHED_QUESTIONS_PER_WINDOW) { clientQuestionWindows.set(client, window); return false; }
  window.push(now); clientQuestionWindows.set(client, window);
  if (clientQuestionWindows.size > 5000) for (const [key, timestamps] of clientQuestionWindows) if (!timestamps.some((timestamp) => now - timestamp < CLIENT_WINDOW_MS)) clientQuestionWindows.delete(key);
  return true;
}

function keywords(question = "") {
  return [...new Set(String(question).toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter((word) => word.length >= 4 && !STOP.has(word)))].sort((a,b) => b.length-a.length).slice(0,6);
}

function currentIntent(question = "") {
  return /\b(latest|today|yesterday|current|recent|news|update|happened|development|2026|this week|this month|now)\b/i.test(question);
}
function analyticalMode(mode = "") { return mode === "Mains Answer" || mode === "MCQs"; }

async function fetchWikipedia(question) {
  const key = `wiki|${normalize(question).toLowerCase()}`;
  const cached = readTimedCache(sourceCache, key, WIKI_CACHE_TTL_MS);
  if (cached) return cached;
  const params = new URLSearchParams({ action: "query", generator: "search", gsrsearch: normalize(question).slice(0,180), gsrlimit: "1", prop: "extracts|info", exintro: "1", explaintext: "1", inprop: "url", format: "json", origin: "*" });
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 4500);
  try {
    const response = await fetch(`https://en.wikipedia.org/w/api.php?${params.toString()}`, { headers: { Accept: "application/json", "User-Agent": "CurrentPulse/1.0 free-source retrieval" }, cache: "force-cache", signal: controller.signal });
    if (!response.ok) return null;
    const pages = Object.values((await response.json())?.query?.pages || {});
    const page = pages[0];
    if (!page?.extract) return null;
    return writeTimedCache(sourceCache, key, { title: page.title, text: normalize(page.extract).slice(0,5000), url: page.fullurl || `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g,"_"))}` });
  } catch { return null; } finally { clearTimeout(timer); }
}

async function fetchGdelt(question) {
  const key = `gdelt|${normalize(question).toLowerCase()}`;
  const cached = readTimedCache(sourceCache, key, GDELT_CACHE_TTL_MS);
  if (cached) return cached;
  const params = new URLSearchParams({ query: normalize(question).slice(0,180), mode: "ArtList", maxrecords: "8", format: "json", sort: "HybridRel" });
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`https://api.gdeltproject.org/api/v2/doc/doc?${params.toString()}`, { headers: { Accept: "application/json", "User-Agent": "CurrentPulse/1.0 GDELT retrieval" }, cache: "no-store", signal: controller.signal });
    if (!response.ok) return [];
    const articles = (await response.json())?.articles || [];
    const seen = new Set();
    const cleaned = articles.filter((item) => item?.url && item?.title).filter((item) => { const key2 = normalize(item.title).toLowerCase(); if (seen.has(key2)) return false; seen.add(key2); return true; }).slice(0,6).map((item) => ({ title: normalize(item.title), url: item.url, domain: item.domain || "", seenDate: item.seendate || "", sourceCountry: item.sourcecountry || "" }));
    return writeTimedCache(sourceCache, key, cleaned);
  } catch { return []; } finally { clearTimeout(timer); }
}

function freeSourceAnswer(question, mode, wiki, gdelt) {
  const parts = [];
  if (wiki?.text) {
    parts.push(`### Background\n\n**${wiki.title}** — ${wiki.text.slice(0, mode === "Prelims Facts" ? 1800 : 2600)}`);
  }
  if (gdelt?.length) {
    const lines = gdelt.slice(0,5).map((item) => `- **${item.title}**${item.domain ? ` — ${item.domain}` : ""}${item.seenDate ? ` (${item.seenDate})` : ""}`);
    parts.push(`### Recent coverage detected by GDELT\n\n${lines.join("\n")}`);
  }
  if (!parts.length) return "";
  if (mode === "Prelims Facts") parts.push("### Exam use\n\n- Use the Wikipedia block for stable background only.\n- Treat GDELT as current-event discovery; verify decisive current figures, office-holders and policy details from the linked original sources.");
  return parts.join("\n\n");
}

function isCoaching(article = {}) { return (article.article_sources || []).some((source) => source?.source_kind === "coaching"); }
async function retrieveArticles(question) {
  const terms = keywords(question); if (!terms.length) return [];
  const client = createServerSupabase();
  const safeTerms = terms.slice(0,3).map((term) => term.replace(/[^a-z0-9-]/g, "")).filter(Boolean); if (!safeTerms.length) return [];
  const orFilter = safeTerms.flatMap((term) => [`title.ilike.%${term}%`,`why_news.ilike.%${term}%`,`static_foundation.ilike.%${term}%`]).join(",");
  const { data, error } = await client.from("articles").select("id,title,slug,category,why_news,static_foundation,data_examples,prelims,mains,updated_at,article_sources(source_kind)").eq("status","published").or(orFilter).order("updated_at",{ascending:false}).limit(12);
  if (error) return [];
  return (data || []).filter((article) => { const stream = isCoaching(article) ? "coverage" : "news"; return stream === "news" ? isDisplayWorthyNews(article) : isPublishedArticleSafe(article,{stream}); }).slice(0,4);
}
function articlePath(article) { return `${isCoaching(article) ? "/current-affairs" : "/news"}/${article.slug}`; }
function buildContext(articles) { return articles.map((a,i)=>`SOURCE ${i+1}: ${a.title}\nURL: ${SITE_URL}${articlePath(a)}\nWHY: ${String(a.why_news||"").slice(0,1000)}\nSTATIC: ${String(a.static_foundation||"").slice(0,800)}\nDATA: ${String(a.data_examples||"").slice(0,900)}\nPRELIMS: ${String(a.prelims||"").slice(0,700)}\nMAINS: ${String(a.mains||"").slice(0,900)}`).join("\n\n---\n\n"); }
function buildInstruction(mode) { if (mode === "Mains Answer") return "Write a concise UPSC GS Mains answer with Introduction, analytical Body, examples, Way Forward and Conclusion."; if (mode === "MCQs") return "Generate 5 UPSC-style MCQs with answers and brief explanations, using only supplied evidence."; return "Explain clearly with compact headings and bullets."; }

export async function POST(request) {
  try {
    const { question, mode = "Explain Topic" } = await request.json();
    const cleanQuestion = normalize(question).slice(0,1200);
    if (!cleanQuestion) return NextResponse.json({ answer: "Please enter a question." }, { status: 400 });
    const cacheKey = answerCacheKey(cleanQuestion, mode);
    const cached = readAnswerCache(cacheKey); if (cached) return NextResponse.json({ ...cached, cached: true });
    if (!allowUncachedQuestion(request)) return NextResponse.json({ answer: "Please wait a few minutes before asking another new question." }, { status: 429, headers: { "Retry-After": "600" } });

    // Quota-first path: Wikipedia for stable knowledge; GDELT only when current intent is present.
    const wantsCurrent = currentIntent(cleanQuestion);
    const [wiki, gdelt] = await Promise.all([
      fetchWikipedia(cleanQuestion),
      wantsCurrent ? fetchGdelt(cleanQuestion) : Promise.resolve([]),
    ]);
    const deterministic = freeSourceAnswer(cleanQuestion, mode, wiki, gdelt);
    const freeSources = [wiki?.url ? { title: wiki.title || "Wikipedia", url: wiki.url, type: "wikipedia" } : null, ...(gdelt || []).map((item)=>({ title:item.title,url:item.url,type:"gdelt-discovery" }))].filter(Boolean);

    if (deterministic && !analyticalMode(mode)) {
      return NextResponse.json(writeAnswerCache(cacheKey, { answer: deterministic, provider: "free-sources", zeroAi: true, sources: freeSources }));
    }

    // Only now touch CurrentPulse DB; this is bounded to one query and 12 rows.
    const articles = await retrieveArticles(cleanQuestion).catch(() => []);
    const cpSources = articles.map((a)=>({ title:a.title,url:`${SITE_URL}${articlePath(a)}`,type:"currentpulse" }));
    const context = [deterministic ? `FREE SOURCE MATERIAL:\n${deterministic}` : "", buildContext(articles)].filter(Boolean).join("\n\n===\n\n");

    if (!analyticalMode(mode) && context) {
      return NextResponse.json(writeAnswerCache(cacheKey, { answer: context, provider: "free-sources-currentpulse", zeroAi: true, sources: [...freeSources,...cpSources] }));
    }

    if (!getConfiguredAiProviders().length) {
      return NextResponse.json(writeAnswerCache(cacheKey, { answer: context || "I could not verify enough material for this query.", provider: "deterministic-fallback", zeroAi: true, sources: [...freeSources,...cpSources] }));
    }

    const prompt = `You are CurrentPulse AI. Use only the supplied evidence for current facts. Stable textbook explanation is allowed only when certain.\n\nQUESTION:\n${cleanQuestion}\n\nTASK:\n${buildInstruction(mode)}\n\nEVIDENCE:\n${context || "No verified evidence retrieved."}\n\nRULES:\n- Do not invent current data, dates, rankings or office-holders.\n- GDELT entries are discovery links, not proof by themselves.\n- Prefer compact headings and bullets.\n- No HTML.`;
    let lastError;
    for (const model of MODELS) {
      try {
        const response = await generateWithRouter({ model, contents: prompt, config: { maxOutputTokens: 1600 } });
        const answer = response?.text?.trim();
        if (answer) return NextResponse.json(writeAnswerCache(cacheKey, { answer, provider: response.provider || "gemini", model: response.model || model, zeroAi: false, sources: [...freeSources,...cpSources] }));
      } catch (error) { lastError = error; }
    }
    return NextResponse.json(writeAnswerCache(cacheKey, { answer: context || "CurrentPulse could not verify enough material right now.", provider: "deterministic-fallback", zeroAi: true, error: lastError?.message || "AI unavailable", sources: [...freeSources,...cpSources] }));
  } catch (error) {
    console.error("Ask AI route error:", error);
    return NextResponse.json({ answer: "Something went wrong while preparing the answer." }, { status: 500 });
  }
}
