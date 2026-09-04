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
function articlePath(article) { return `${isCoaching(article) ? "/current-affairs" : "/news"}/${article.slug}`; }

function compactKey(value = "") {
  return String(value || "").toLowerCase().replace(/<[^>]+>/g, " ").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}
function stripControlLine(value = "", articleTitle = "") {
  const line = normalize(String(value || "").replace(/^\s*[•▪◦*-]\s*/, ""));
  if (!line) return "";
  const key = compactKey(line);
  if (!key) return "";
  if (articleTitle && key === compactKey(articleTitle)) return "";
  if (/^\[\[ca_(?:start|end)\]\]$/i.test(line)) return "";
  if (/^ca_(?:title|category|gs|date|image)\s*:/i.test(line)) return "";
  if (/^current\s+affairs\s+\d+$/i.test(line)) return "";
  if (/^(?:category|gs|date|quick rule|data rule)$/i.test(line)) return "";
  if (/^(?:read highlighted facts first|30\+ numerical facts)$/i.test(line)) return "";
  if (/^(?:static|data|prelims|mains)\s*:\s*$/i.test(line)) return "";
  if (/^(?:source|sources)\s*\d*\s*:?$/i.test(line)) return "";
  if (/^url\s*:/i.test(line)) return "";
  return line;
}

const SECTION_HEADINGS = [
  ["fast", /^(?:⚡\s*)?fast\s+read\b/i],
  ["why", /^why\s+in\s+news\b/i],
  ["facts", /^(?:top\s+)?data\s*&\s*facts(?:\s+for\s+upsc)?\b|^top\s+data\s*&\s*facts\b|^key\s+facts\b/i],
  ["history", /^historical\s+perspective\b/i],
  ["economy", /^economic\s+perspective\b/i],
  ["geography", /^geographical\s+perspective\b/i],
  ["environment", /^environmental\s+perspective\b/i],
  ["social", /^social\s+perspective\b/i],
  ["governance", /^(?:political(?:\s*\/\s*|\s*&\s*)governance|political)\s+perspective\b/i],
  ["pros", /^pros\b/i],
  ["cons", /^cons\b/i],
  ["way", /^way\s+forward\b/i],
  ["revision", /^(?:prelims\s+quick\s+revision|quick\s+revision)\b/i],
  ["objective", /^(?:probable\s+)?(?:prelims|objective)\s+question\b/i],
  ["descriptive", /^(?:probable\s+)?(?:mains|descriptive)\s+question\b/i],
  ["sources", /^sources?\b/i],
];
function sectionName(line = "") {
  return SECTION_HEADINGS.find(([, pattern]) => pattern.test(normalize(line)))?.[0] || "";
}
function splitSentences(text = "") {
  return String(text || "").split(/(?<=[.!?])\s+(?=[A-Z0-9])/).map(normalize).filter((item) => item.length >= 25);
}
function uniqueLines(lines = [], limit = 8) {
  const seen = [];
  const out = [];
  for (const raw of lines) {
    const line = normalize(raw);
    const key = compactKey(line);
    if (!key || key.length < 12) continue;
    const duplicate = seen.some((prior) => prior === key || (key.length > 45 && prior.includes(key)) || (prior.length > 45 && key.includes(prior)));
    if (duplicate) continue;
    seen.push(key);
    out.push(line);
    if (out.length >= limit) break;
  }
  return out;
}
function parseArticleSections(article = {}) {
  const sections = { fast: [], why: [], facts: [], history: [], economy: [], geography: [], environment: [], social: [], governance: [], pros: [], cons: [], way: [], revision: [], objective: [], descriptive: [], unassigned: [] };
  const raw = [article.why_news, article.static_foundation, article.data_examples, article.prelims, article.mains].filter(Boolean).join("\n");
  let active = "unassigned";
  for (const rawLine of String(raw || "").split(/\r?\n/)) {
    const line = stripControlLine(rawLine, article.title);
    if (!line) continue;
    const next = sectionName(line);
    if (next) { active = next; continue; }
    if (active === "sources" || active === "objective" || active === "descriptive") continue;
    sections[active].push(line);
  }
  if (!sections.why.length) sections.why = splitSentences(stripControlLine(article.why_news, article.title)).slice(0,4);
  if (!sections.facts.length && article.data_examples) sections.facts = splitSentences(article.data_examples);
  if (!sections.revision.length && article.prelims) sections.revision = splitSentences(article.prelims);
  if (!sections.way.length && article.mains) {
    const mains = splitSentences(article.mains);
    sections.governance.push(...mains.slice(0,4));
  }
  for (const key of Object.keys(sections)) sections[key] = uniqueLines(sections[key], key === "facts" ? 12 : 8);
  return sections;
}
function scoreArticle(article, terms = []) {
  const title = compactKey(article.title);
  const body = compactKey([article.why_news,article.static_foundation,article.data_examples,article.prelims,article.mains].join(" "));
  return terms.reduce((score, term) => score + (title.includes(term) ? 8 : 0) + (body.includes(term) ? 2 : 0), 0);
}
async function retrieveArticles(question) {
  const terms = keywords(question); if (!terms.length) return [];
  const client = createServerSupabase();
  const safeTerms = terms.slice(0,3).map((term) => term.replace(/[^a-z0-9-]/g, "")).filter(Boolean); if (!safeTerms.length) return [];
  const orFilter = safeTerms.flatMap((term) => [`title.ilike.%${term}%`,`why_news.ilike.%${term}%`,`static_foundation.ilike.%${term}%`]).join(",");
  const { data, error } = await client.from("articles").select("id,title,slug,category,why_news,static_foundation,data_examples,prelims,mains,updated_at,article_sources(source_kind)").eq("status","published").or(orFilter).order("updated_at",{ascending:false}).limit(12);
  if (error) return [];
  return (data || [])
    .filter((article) => { const stream = isCoaching(article) ? "coverage" : "news"; return stream === "news" ? isDisplayWorthyNews(article) : isPublishedArticleSafe(article,{stream}); })
    .sort((a,b) => scoreArticle(b, safeTerms) - scoreArticle(a, safeTerms))
    .slice(0,4);
}
function emphasize(line = "") {
  return String(line || "")
    .replace(/\b(\d[\d,.]*(?:\s*(?:%|crore|lakh|million|billion|MMT|MW|GW|km|years?|days?|FIRs?))?)\b/g, "**$1**")
    .replace(/\b(NCPCR|CARA|NABARD|IMD|ISRO|UNEP|SEBI|RBI|CFT|AML|BRICS|GSLV-F17|EOS-05|PM-JANMAN|AgriStack|NAMASTE)\b/g, "**$1**");
}
function bullets(lines = [], limit = 5) {
  return uniqueLines(lines, limit).map((line) => `- ${emphasize(line)}`).join("\n");
}
function composeCurrentPulseAnswer(question, mode, articles = []) {
  if (!articles.length) return "";
  const primary = articles[0];
  const s = parseArticleSections(primary);
  const parts = [];
  const direct = uniqueLines([...s.why, ...s.fast, ...s.unassigned], 3);
  if (direct.length) parts.push(`### Direct answer\n\n${direct.map(emphasize).join(" ")}`);

  const facts = uniqueLines([...s.fast, ...s.facts, ...s.revision], mode === "Prelims Facts" ? 8 : 6);
  if (facts.length) parts.push(`### Key facts\n\n${bullets(facts, mode === "Prelims Facts" ? 8 : 6)}`);

  const q = normalize(question).toLowerCase();
  if (/\b(pros?|advantages?|benefits?)\b/.test(q) && s.pros.length) parts.push(`### Benefits\n\n${bullets(s.pros,6)}`);
  if (/\b(cons?|disadvantages?|limitations?|challenges?|risks?)\b/.test(q) && s.cons.length) parts.push(`### Challenges\n\n${bullets(s.cons,6)}`);
  if (/\b(way forward|solution|solutions|reform|reforms|what should|next steps?)\b/.test(q) && s.way.length) parts.push(`### Way forward\n\n${bullets(s.way,6)}`);

  const whyMatters = uniqueLines([...s.economy, ...s.social, ...s.environment, ...s.governance], 4);
  if (whyMatters.length && mode !== "Prelims Facts") parts.push(`### Why it matters\n\n${bullets(whyMatters,4)}`);

  if (mode === "Prelims Facts" && s.revision.length) parts.push(`### Quick revision\n\n${bullets(s.revision,6)}`);

  if (articles.length > 1) {
    const related = articles.slice(1,3).map((a) => `- **${a.title}**`).join("\n");
    if (related) parts.push(`### Related CurrentPulse coverage\n\n${related}`);
  }
  return parts.join("\n\n");
}
function buildContext(articles) {
  return articles.map((a,i) => {
    const s = parseArticleSections(a);
    const evidence = uniqueLines([...s.why,...s.fast,...s.facts,...s.economy,...s.social,...s.governance,...s.way], 16).join("\n");
    return `SOURCE ${i+1}: ${a.title}\n${evidence}`;
  }).join("\n\n---\n\n");
}
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

    // Current topics should prefer CurrentPulse's own published evidence instead of dumping raw DB fields.
    const articles = (wantsCurrent || !deterministic || analyticalMode(mode)) ? await retrieveArticles(cleanQuestion).catch(() => []) : [];
    const cpSources = articles.map((a)=>({ title:a.title,url:`${SITE_URL}${articlePath(a)}`,type:"currentpulse" }));
    const composed = composeCurrentPulseAnswer(cleanQuestion, mode, articles);

    if (!analyticalMode(mode)) {
      if (composed) return NextResponse.json(writeAnswerCache(cacheKey, { answer: composed, provider: "CurrentPulse sources", zeroAi: true, sources: cpSources.slice(0,3) }));
      if (deterministic) return NextResponse.json(writeAnswerCache(cacheKey, { answer: deterministic, provider: "Free reference", zeroAi: true, sources: freeSources.slice(0,3) }));
    }

    const context = [deterministic ? `FREE SOURCE MATERIAL:\n${deterministic}` : "", buildContext(articles)].filter(Boolean).join("\n\n===\n\n");

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
