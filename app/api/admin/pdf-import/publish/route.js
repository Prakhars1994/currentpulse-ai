import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAuthenticatedAdmin } from "@/lib/adminAuth";
import { SITE_URL } from "@/lib/siteUrl";
import { serializeNewsPresentation } from "@/lib/news/newsPresentation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 150;

const MAX_ARTICLES_PER_REQUEST = 20;
const MAX_ARTICLE_TEXT = 120_000;

function clean(value = "") {
  return String(value || "")
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

function safeDate(value = "") {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) {
    return new Date().toISOString().slice(0, 10);
  }
  return value;
}

function slugify(value = "") {
  return clean(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 130);
}

function hash(value = "") {
  return createHash("sha256").update(String(value || "")).digest("hex");
}

function publicationTimestamp(date) {
  return `${date}T12:00:00+05:30`;
}

function buildArticlePayload(article, { stream, date, fileHash } = {}) {
  const title = clean(article.title).slice(0, 180);
  const importIndex = Number(article.importIndex);
  const suffix = `${date.replace(/-/g, "")}-${fileHash.slice(0, 7)}-${importIndex}`;
  const slugPrefix = stream === "ca_hi" ? "hindi-current-affairs" : (slugify(title) || "pdf-import");
  const slug = `${slugPrefix}-${suffix}`.slice(0, 180);
  const fullText = clean(article.fullText).slice(0, MAX_ARTICLE_TEXT);
  const whyNews = clean(article.why_news).slice(0, MAX_ARTICLE_TEXT);
  const staticFoundation = clean(article.static_foundation).slice(0, MAX_ARTICLE_TEXT);
  const dataExamples = clean(article.data_examples).slice(0, MAX_ARTICLE_TEXT);
  const prelims = clean(article.prelims).slice(0, MAX_ARTICLE_TEXT);
  const mains = clean(article.mains).slice(0, MAX_ARTICLE_TEXT);
  const question = clean(article.question).slice(0, 20_000);
  const indiaRelevance = clean(article.india_relevance).slice(0, MAX_ARTICLE_TEXT);
  const category = clean(article.category).slice(0, 80) || "Polity & Governance";
  const paper = clean(article.paper).slice(0, 30) || "Prelims";
  const createdAt = publicationTimestamp(date);

  const common = {
    title,
    slug,
    category,
    paper,
    why_news: whyNews || fullText.slice(0, 900),
    prelims,
    mains,
    question,
    content: fullText,
    static_foundation: staticFoundation,
    data_examples: dataExamples,
    india_relevance: indiaRelevance,
    syllabus_linkage:
      stream === "ca" || stream === "ca_hi"
        ? `- **Paper:** ${paper}\n- **Theme:** ${category}`
        : "",
    seo_title: clean(article.seo_title || title).slice(0, 180),
    seo_description: clean(
      article.seo_description || whyNews || fullText
    ).slice(0, 160),
    tags: [...new Set(
      (Array.isArray(article.tags) ? article.tags : [category, paper, "PDF Import"])
        .map(clean)
        .filter(Boolean)
        .slice(0, 16)
    )],
    status: "published",
    language: stream === "ca_hi" ? "hi" : "en",
    created_at: createdAt,
    updated_at: createdAt,
    published_at: `${date}T12:00:00`,
    image_alt: title,
    image_search_query: title,
    quality_score: 92,
    quality_version: 4,
    quality_flags: [
      "admin_pdf_import",
      "zero_ai_pdf_import",
      "full_text_preserved",
      stream === "ca" || stream === "ca_hi" ? "ca_pdf_import" : "news_pdf_import",
      ...(stream === "ca_hi" ? ["hindi_ca_pdf_import"] : []),
    ],
  };

  if (stream === "news") {
    return {
      ...common,
      content: serializeNewsPresentation({
        title,
        why_news: common.why_news,
        data_examples: dataExamples,
        static_foundation: staticFoundation || fullText,
        india_relevance: indiaRelevance,
      }),
    };
  }

  return common;
}

export async function POST(request) {
  const auth = await requireAuthenticatedAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const stream =
      body?.stream === "news"
        ? "news"
        : body?.stream === "ca_hi"
          ? "ca_hi"
          : body?.stream === "ca"
            ? "ca"
          : "";
    const fileName = clean(body?.fileName).slice(0, 220);
    const fileHash = clean(body?.fileHash).toLowerCase();
    const date = safeDate(body?.publishedAt);
    const articles = Array.isArray(body?.articles) ? body.articles : [];

    if (!stream) {
      return NextResponse.json(
        { success: false, message: "Choose Current Affairs or News." },
        { status: 400 }
      );
    }

    if (!fileName || !/^[a-f0-9]{64}$/i.test(fileHash)) {
      return NextResponse.json(
        { success: false, message: "PDF filename/hash is invalid." },
        { status: 400 }
      );
    }

    if (articles.length < 1 || articles.length > MAX_ARTICLES_PER_REQUEST) {
      return NextResponse.json(
        {
          success: false,
          message: `Publish 1-${MAX_ARTICLES_PER_REQUEST} articles per batch.`,
        },
        { status: 400 }
      );
    }

    const normalized = articles.map((article, batchIndex) => {
      const importIndex = Number(article?.importIndex);

      if (
        !Number.isInteger(importIndex) ||
        importIndex < 0 ||
        clean(article?.title).length < 5 ||
        clean(article?.fullText).length < 80
      ) {
        throw new Error(
          `Article ${batchIndex + 1} is missing a valid title, index or body.`
        );
      }

      return {
        sourceKey: `pdf:${stream}:${fileHash}:${importIndex}`,
        importIndex,
        article,
      };
    });

    const { data: existingSources, error: existingError } = await auth.supabase
      .from("article_sources")
      .select("source_key")
      .in("source_key", normalized.map((item) => item.sourceKey));

    if (existingError) {
      throw new Error(`PDF duplicate lookup failed: ${existingError.message}`);
    }

    const existing = new Set(
      (existingSources || [])
        .map((row) => clean(row.source_key))
        .filter(Boolean)
    );

    const results = [];

    for (const item of normalized) {
      if (existing.has(item.sourceKey)) {
        results.push({
          status: "duplicate",
          importIndex: item.importIndex,
          title: clean(item.article.title),
        });
        continue;
      }

      const payload = buildArticlePayload(item.article, {
        stream,
        date,
        fileHash,
      });

      const { data: inserted, error: insertError } = await auth.supabase
        .from("articles")
        .insert([payload])
        .select("id,slug,title")
        .single();

      if (insertError) {
        results.push({
          status: "failed",
          importIndex: item.importIndex,
          title: payload.title,
          error: insertError.message,
        });
        continue;
      }

      const sourceName =
        stream === "ca" || stream === "ca_hi"
          ? "CurrentPulse Admin CA PDF"
          : "CurrentPulse Admin News PDF";
      const sourceUrl =
        stream === "ca" || stream === "ca_hi"
          ? `${SITE_URL}${stream === "ca_hi" ? "/current-affairs/hindi" : "/current-affairs"}`
          : `${SITE_URL}/news`;
      const now = new Date().toISOString();

      const { error: sourceError } = await auth.supabase
        .from("article_sources")
        .insert([{
          article_id: inserted.id,
          event_key: hash(`${date}|${payload.title}`).slice(0, 32),
          source_key: item.sourceKey,
          source_kind: stream === "ca" || stream === "ca_hi" ? "coaching" : "news",
          source_name: sourceName,
          source_title: `Imported from ${fileName}`,
          source_url: sourceUrl,
          source_published_at: publicationTimestamp(date),
          content_hash: hash(item.article.fullText),
          merged_at: now,
          updated_at: now,
        }]);

      if (sourceError) {
        await auth.supabase.from("articles").delete().eq("id", inserted.id);

        results.push({
          status: "failed",
          importIndex: item.importIndex,
          title: payload.title,
          error: `Source registration failed: ${sourceError.message}`,
        });
        continue;
      }

      results.push({
        status: "published",
        importIndex: item.importIndex,
        articleId: inserted.id,
        slug: inserted.slug,
        title: inserted.title,
      });
    }

    const published = results.filter((item) => item.status === "published").length;
    const duplicates = results.filter((item) => item.status === "duplicate").length;
    const failed = results.filter((item) => item.status === "failed").length;

    return NextResponse.json(
      {
        success: published + duplicates > 0,
        stats: {
          requested: articles.length,
          published,
          duplicates,
          failed,
        },
        releaseRequired: published > 0,
        message:
          published > 0
            ? `Published ${published}; duplicates ${duplicates}; failed ${failed}.`
            : duplicates > 0 && failed === 0
              ? `All ${duplicates} selected articles were already imported.`
              : "No selected PDF articles were published.",
        results,
      },
      { status: published + duplicates > 0 ? 200 : 502 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "PDF import failed.",
      },
      { status: 500 }
    );
  }
}
