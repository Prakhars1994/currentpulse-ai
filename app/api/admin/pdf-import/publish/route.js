import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAuthenticatedAdmin } from "@/lib/adminAuth";
import { requestReaderRelease } from "@/lib/publisher/requestReaderRelease";
import { resolveGovernmentArticleImage } from "@/lib/news/governmentImageResolver";
import { isVerifiedReusableArticleImage } from "@/lib/news/categoryImage";
import { isSameEvent } from "@/lib/news/eventCluster";
import { SITE_URL } from "@/lib/siteUrl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 150;
const MAX_ARTICLES_PER_REQUEST = 20;
const MAX_ARTICLE_TEXT = 120_000;
const IMAGE_ENRICHMENT_DEADLINE_MS = 8_000;
const IMAGE_BANK_LIMIT = 80;

function clean(value = "") { return String(value || "").replace(/\u0000/g, "").replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{4,}/g, "\n\n\n").trim(); }
function preserveText(value = "") { return String(value ?? "").replace(/\u0000/g, ""); }
function todayIst() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
function safeDate(value = "") { return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? String(value) : todayIst(); }
function slugify(value = "") { return clean(value).toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 130); }
function hash(value = "") { return createHash("sha256").update(String(value ?? "")).digest("hex"); }
function publicationTimestamp(date) { return `${date}T12:00:00+05:30`; }

function buildArticlePayload(article, { stream, date, fileHash } = {}) {
  const title = clean(article.title).slice(0, 180); const importIndex = Number(article.importIndex); const suffix = `${date.replace(/-/g, "")}-${fileHash.slice(0, 7)}-${importIndex}`; const slugPrefix = stream === "ca_hi" ? "hindi-current-affairs" : (slugify(title) || "pdf-import"); const slug = `${slugPrefix}-${suffix}`.slice(0, 180);
  const fullText = preserveText(article.fullText).slice(0, MAX_ARTICLE_TEXT); const whyNews = preserveText(article.why_news).slice(0, MAX_ARTICLE_TEXT); const staticFoundation = preserveText(article.static_foundation).slice(0, MAX_ARTICLE_TEXT); const dataExamples = preserveText(article.data_examples).slice(0, MAX_ARTICLE_TEXT); const prelims = preserveText(article.prelims).slice(0, MAX_ARTICLE_TEXT); const mains = preserveText(article.mains).slice(0, MAX_ARTICLE_TEXT); const question = preserveText(article.question).slice(0, 20_000); const indiaRelevance = preserveText(article.india_relevance).slice(0, MAX_ARTICLE_TEXT);
  const category = clean(article.category).slice(0, 80) || "Polity & Governance"; const paper = clean(article.paper).slice(0, 30) || "Prelims"; const createdAt = publicationTimestamp(date); const imageUrl = clean(article.image_url).slice(0, 2000); const imageSourceUrl = clean(article.image_source_url).slice(0, 2000); const imageCaption = clean(article.image_caption).slice(0, 700);
  const mapLocations = (Array.isArray(article.map_locations) ? article.map_locations : clean(article.map_locations).split(",")).map((value) => clean(value).slice(0, 100)).filter(Boolean).slice(0, 8);
  const reviewedManualImage = Boolean(imageUrl && imageSourceUrl && imageCaption);
  return { title, slug, category, paper, why_news: whyNews || fullText.slice(0, 900), prelims, mains, question, content: fullText, static_foundation: staticFoundation, data_examples: dataExamples, india_relevance: indiaRelevance, syllabus_linkage: stream === "ca" || stream === "ca_hi" ? `- **Paper:** ${paper}\n- **Theme:** ${category}` : "", seo_title: clean(article.seo_title || title).slice(0, 180), seo_description: clean(article.seo_description || whyNews || fullText).slice(0, 160), tags: [...new Set((Array.isArray(article.tags) ? article.tags : [category, paper, "PDF Import"]).map(clean).filter(Boolean).slice(0, 16))], status: "published", language: stream === "ca_hi" ? "hi" : "en", created_at: createdAt, updated_at: createdAt, published_at: `${date}T12:00:00`, image_alt: title, image_search_query: title, image_url: imageUrl || null, image_source_url: imageSourceUrl || null, image_caption: imageCaption || null, image_resolution: reviewedManualImage ? { status: "preserved_existing", provider: "manual_license_review", requests_used: 0, attribution: imageCaption, source_page_url: imageSourceUrl, license_or_usage: "manual_license_review", search_query: title } : null, map_locations: mapLocations, quality_score: 100, quality_version: 4, quality_flags: ["admin_pdf_import","zero_ai_pdf_import","full_text_preserved",...(reviewedManualImage ? ["manual_image_license_review"] : []),stream === "ca" || stream === "ca_hi" ? "ca_pdf_import" : "news_pdf_import",...(stream === "ca_hi" ? ["hindi_ca_pdf_import"] : [])], manual_protected: true };
}

function eventShape(article = {}) {
  return {
    title: article.title || "",
    description: article.why_news || "",
    published_at: article.published_at || article.created_at || null,
  };
}

async function loadReusableImageBank(supabase) {
  const { data, error } = await supabase
    .from("articles")
    .select("id,title,category,why_news,published_at,created_at,image,image_url,image_alt,image_caption,image_source_url,image_search_query,image_resolution")
    .eq("status", "published")
    .not("image_url", "is", null)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(IMAGE_BANK_LIMIT);
  if (error) {
    console.error("PDF reusable image bank lookup failed:", error.message);
    return [];
  }
  return (data || []).filter((article) => isVerifiedReusableArticleImage(article));
}

function findReusableEventImage(payload, imageBank = []) {
  const target = eventShape(payload);
  return imageBank.find((candidate) => {
    if (!candidate?.image_url && !candidate?.image) return false;
    if (payload.category && candidate.category && clean(payload.category).toLowerCase() !== clean(candidate.category).toLowerCase()) return false;
    return isSameEvent(target, eventShape(candidate));
  }) || null;
}

function reusableImagePatch(candidate, payload) {
  const imageUrl = candidate.image_url || candidate.image;
  return {
    image: imageUrl,
    image_url: imageUrl,
    image_alt: candidate.image_alt || payload.title,
    image_caption: candidate.image_caption || null,
    image_source_url: candidate.image_source_url || null,
    image_search_query: payload.image_search_query || payload.title,
    image_resolution: {
      status: "preserved_existing",
      provider: candidate.image_resolution?.provider || "existing_article",
      source_article_id: candidate.id,
      requests_used: 0,
      search_query: payload.image_search_query || payload.title,
    },
    updated_at: new Date().toISOString(),
  };
}

async function enrichPublishedArticleImage(supabase, inserted, payload, imageBank = []) {
  if (payload.image_url) return { status: "provided", requestsUsed: 0 };
  try {
    const reusable = findReusableEventImage(payload, imageBank);
    if (reusable) {
      const patch = reusableImagePatch(reusable, payload);
      const { error } = await supabase.from("articles").update(patch).eq("id", inserted.id);
      if (error) throw error;
      imageBank.unshift({ ...payload, ...patch, id: inserted.id, slug: inserted.slug });
      return { status: "reused", sourceArticleId: reusable.id, requestsUsed: 0 };
    }

    const deadlineAt = Date.now() + IMAGE_ENRICHMENT_DEADLINE_MS;
    const resolved = await resolveGovernmentArticleImage({ ...payload, id: inserted.id, slug: inserted.slug }, { deadlineAt });
    const patch = { image_resolution: resolved.resolution, image_search_query: resolved.query || resolved.resolution?.search_query || payload.image_search_query, updated_at: new Date().toISOString() };
    if (resolved.image) Object.assign(patch, { image: resolved.image.url, image_url: resolved.image.url, image_alt: resolved.image.alt || payload.title, image_caption: resolved.image.attribution || null, image_source_url: resolved.image.sourcePageUrl || null });
    const { error } = await supabase.from("articles").update(patch).eq("id", inserted.id); if (error) throw error;
    if (resolved.image) imageBank.unshift({ ...payload, ...patch, id: inserted.id, slug: inserted.slug });
    return { status: resolved.image ? "resolved" : "no_safe_image", provider: resolved.resolution?.provider || null, requestsUsed: resolved.resolution?.requests_used || 0 };
  } catch (error) { console.error("PDF article image enrichment failed:", error?.message || error); return { status: "failed", error: error?.message || "Image enrichment failed" }; }
}

async function enrichExistingPdfArticle(supabase, articleId, draftPayload, imageBank = []) {
  const { data: existingArticle, error } = await supabase.from("articles").select("id,slug,title,category,why_news,published_at,created_at,image,image_url,image_source_url,image_caption,image_search_query,image_resolution").eq("id", articleId).single();
  if (error || !existingArticle) return { status: "duplicate" };
  if (isVerifiedReusableArticleImage(existingArticle)) return { status: "already_has_image", requestsUsed: 0 };
  return enrichPublishedArticleImage(supabase, existingArticle, { ...draftPayload, ...existingArticle, image_url: null }, imageBank);
}

export async function POST(request) {
  const auth = await requireAuthenticatedAdmin(request); if (!auth.ok) return auth.response;
  try {
    const body = await request.json(); const stream = body?.stream === "news" ? "news" : body?.stream === "ca_hi" ? "ca_hi" : body?.stream === "ca" ? "ca" : ""; const fileName = clean(body?.fileName).slice(0, 220); const fileHash = clean(body?.fileHash).toLowerCase(); const date = safeDate(body?.publishedAt); const articles = Array.isArray(body?.articles) ? body.articles : [];
    if (!stream) return NextResponse.json({ success: false, message: "Choose Current Affairs or News." }, { status: 400 });
    if (!fileName || !/^[a-f0-9]{64}$/i.test(fileHash)) return NextResponse.json({ success: false, message: "PDF filename/hash is invalid." }, { status: 400 });
    if (articles.length < 1 || articles.length > MAX_ARTICLES_PER_REQUEST) return NextResponse.json({ success: false, message: `Publish 1-${MAX_ARTICLES_PER_REQUEST} articles per batch.` }, { status: 400 });
    const normalized = articles.map((article, batchIndex) => { const importIndex = Number(article?.importIndex); const title = clean(article?.title); const fullText = preserveText(article?.fullText); if (!Number.isInteger(importIndex) || importIndex < 0 || title.length < 5 || fullText.trim().length < 80) throw new Error(`Article ${batchIndex + 1} is missing a valid title, index or body.`); return { sourceKey: `pdf:${stream}:${fileHash}:${importIndex}`, importIndex, article }; });
    const { data: existingSources, error: existingError } = await auth.supabase.from("article_sources").select("source_key,article_id").in("source_key", normalized.map((item) => item.sourceKey)); if (existingError) throw new Error(`PDF duplicate lookup failed: ${existingError.message}`); const existing = new Map((existingSources || []).map((row) => [clean(row.source_key), row.article_id])); const results = [];
    const imageBank = await loadReusableImageBank(auth.supabase);
    for (const item of normalized) {
      const draftPayload = buildArticlePayload(item.article, { stream, date, fileHash });
      if (existing.has(item.sourceKey)) { const image = await enrichExistingPdfArticle(auth.supabase, existing.get(item.sourceKey), draftPayload, imageBank); results.push({ status: "duplicate", importIndex: item.importIndex, title: clean(item.article.title), image }); continue; }
      const payload = draftPayload;
      const { data: inserted, error: insertError } = await auth.supabase.from("articles").insert([payload]).select("id,slug,title").single(); if (insertError) { results.push({ status: "failed", importIndex: item.importIndex, title: payload.title, error: insertError.message }); continue; }
      const isCurrentAffairs = stream === "ca" || stream === "ca_hi"; const sourceName = isCurrentAffairs ? "CurrentPulse Admin CA PDF" : "CurrentPulse Admin News PDF"; const sourceUrl = isCurrentAffairs ? `${SITE_URL}${stream === "ca_hi" ? "/current-affairs?lang=hi" : "/current-affairs"}` : `${SITE_URL}/news`; const now = new Date().toISOString();
      const { error: sourceError } = await auth.supabase.from("article_sources").insert([{ article_id: inserted.id, event_key: hash(`${date}|${payload.title}`).slice(0, 32), source_key: item.sourceKey, source_kind: isCurrentAffairs ? "coaching" : "news", source_name: sourceName, source_title: `Imported from ${fileName}`, source_url: sourceUrl, source_published_at: publicationTimestamp(date), content_hash: hash(preserveText(item.article.fullText)), merged_at: now, updated_at: now }]);
      if (sourceError) { await auth.supabase.from("articles").delete().eq("id", inserted.id); results.push({ status: "failed", importIndex: item.importIndex, title: payload.title, error: `Source registration failed: ${sourceError.message}` }); continue; }
      const image = await enrichPublishedArticleImage(auth.supabase, inserted, payload, imageBank);
      results.push({ status: "published", importIndex: item.importIndex, articleId: inserted.id, slug: inserted.slug, title: inserted.title, image });
    }
    const publishedRows = results.filter((item) => item.status === "published"); const published = publishedRows.length; const duplicates = results.filter((item) => item.status === "duplicate").length; const failed = results.filter((item) => item.status === "failed").length; let readerRefreshQueued = false; let readerRefreshDurable = false; let readerRefreshWarning = "";
    if (published > 0) { try { const release = await requestReaderRelease({ articleId: publishedRows.at(-1).articleId, stream: stream === "news" ? "news" : "coverage", supabase: auth.supabase }); readerRefreshQueued = true; readerRefreshDurable = Boolean(release?.durable); } catch (dispatchError) { readerRefreshDurable = Boolean(dispatchError?.durable); readerRefreshWarning = "Articles are published in the database, but the immediate reader refresh could not be dispatched."; console.error("PDF reader release dispatch error:", dispatchError); } }
    const success = published + duplicates > 0; const baseMessage = published > 0 ? `Published ${published}; duplicates ${duplicates}; failed ${failed}.` : duplicates > 0 && failed === 0 ? `All ${duplicates} selected articles were already imported; missing images were checked once.` : "No selected PDF articles were published.";
    return NextResponse.json({ success, stats: { requested: articles.length, published, duplicates, failed }, releaseRequired: published > 0, readerRefreshQueued, readerRefreshDurable, readerRefreshWarning, message: readerRefreshWarning ? `${baseMessage} ${readerRefreshWarning}` : published > 0 && readerRefreshQueued ? `${baseMessage} Live reader refresh queued.` : baseMessage, results }, { status: success ? 200 : 502 });
  } catch (error) { return NextResponse.json({ success: false, message: error?.message || "PDF import failed." }, { status: 500 }); }
}
