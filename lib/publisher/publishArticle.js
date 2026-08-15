import { generateArticle } from "@/lib/ai/generateArticle";
import { findDuplicateArticle } from "@/lib/news/duplicateRepository";
import { classifyNewsCategory, correctTaxonomy } from "@/lib/contentTaxonomy";
import { persistRemoteArticleImage } from "@/lib/news/imageStorage";
import { isVerifiedReusableArticleImage } from "@/lib/news/categoryImage";
import { findRelevantCommonsImage } from "@/lib/news/relevantImage";
import { enrichNewsSource } from "@/lib/news/sourceEnricher";
import { generateEventKey } from "@/lib/news/eventCluster";
import { createHash } from "node:crypto";
import { SITE_URL } from "@/lib/siteUrl";
import { serializeNewsPresentation, parseNewsPresentation } from "@/lib/news/newsPresentation";
import { assessNewsOutputQuality } from "@/lib/news/newsOutputQuality";
import { enqueueNotificationEvent } from "@/lib/notifications/events";
import {
  assessCoverageEventness,
  assessNewsCandidate,
  assessPublishedArticle,
} from "@/lib/editorial/publicationSafety";
import { assessNumericFactConsistency } from "@/lib/editorial/numericFactGuard";

function sha256(value = "") {
  return createHash("sha256").update(String(value || "")).digest("hex");
}

async function recordNewsSource(supabase, articleId, slug, sourceItem = {}) {
  if (sourceItem.trustedCoverage) return;
  const sourceUrl = cleanText(sourceItem.url) || `${SITE_URL}/news/${slug}`;
  const sourceName = cleanText(sourceItem.source || sourceItem.sourceName) || "News source";
  const sourceTitle = cleanText(sourceItem.title);
  const sourceKey = `news:${sha256(`${sourceUrl}|${sourceTitle}`).slice(0, 40)}`;
  const contentHash = sha256(`${sourceTitle}|${sourceItem.description || ""}|${sourceItem.content || ""}`);
  const eventKey = generateEventKey({ title: sourceTitle, description: sourceItem.description || sourceItem.content || "" });
  const { error } = await supabase.from("article_sources").upsert({
    article_id: articleId,
    event_key: eventKey || null,
    source_key: sourceKey,
    source_kind: "news",
    source_name: sourceName,
    source_title: sourceTitle || null,
    source_url: sourceUrl,
    source_published_at: sourceItem.publishedAt || sourceItem.published_at || null,
    content_hash: contentHash,
    updated_at: new Date().toISOString(),
  }, { onConflict: "source_key" });
  if (error && error.code !== "42P01") {
    console.warn("[Publisher] Could not record news source:", error.message);
  }
}

async function findExistingArticleByEventKey(supabase, sourceItem = {}) {
  const eventKey = generateEventKey({
    title: sourceItem.title,
    description: sourceItem.description || sourceItem.content || "",
  });
  if (!eventKey) return null;

  const { data: rows, error } = await supabase
    .from("article_sources")
    .select("article_id,source_published_at")
    .eq("event_key", eventKey)
    .order("updated_at", { ascending: false })
    .limit(12);
  if (error) {
    if (error.code !== "42P01") console.warn("[Publisher] Event registry lookup failed:", error.message);
    return null;
  }
  const ids = [...new Set((rows || []).map((row) => Number(row.article_id)).filter(Boolean))];
  if (!ids.length) return null;

  const { data: articles, error: articleError } = await supabase
    .from("articles")
    .select("id,title,slug,created_at,status")
    .in("id", ids)
    .eq("status", "published");
  if (articleError) return null;

  const incoming = new Date(sourceItem.publishedAt || sourceItem.published_at || Date.now()).getTime();
  const fourDays = 4 * 86_400_000;
  return (articles || []).find((article) => {
    const created = new Date(article.created_at || 0).getTime();
    return !Number.isFinite(incoming) || !Number.isFinite(created) || Math.abs(incoming - created) <= fourDays;
  }) || null;
}

function enforceNumericGuard(source, generated, label = "article") {
  const assessment = assessNumericFactConsistency(source, generated);
  if (!assessment.allowed) {
    throw new Error(`PUBLICATION_BLOCKED: ${assessment.code}: ${label}: ${assessment.reason}`);
  }
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function stripHtml(value) {
  return cleanText(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function isStudyReady(article = {}) {
  return (
    cleanText(article.syllabus_linkage).length >= 20 &&
    cleanText(article.prelims).length >= 60 &&
    cleanText(article.mains).length >= 100
  );
}

function prepareSourceText(value) {
  return cleanText(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/p\s*>/gi, "\n\n")
    .replace(/<\s*li(?:\s[^>]*)?>([\s\S]*?)<\s*\/li\s*>/gi, "\n- $1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function explicitlyLicensedSourceImage(sourceItem = {}) {
  const license = cleanText(
    sourceItem.image_license || sourceItem.imageLicense || sourceItem.license
  );
  if (!/creative commons|cc[ -]?(?:by|zero|0)|public domain|gfdl|government open data|open government licen[cs]e/i.test(license)) {
    return "";
  }
  if (/non[ -]?commercial|no[ -]?derivatives|all rights reserved/i.test(license)) {
    return "";
  }
  return (
    cleanText(sourceItem.image) ||
    cleanText(sourceItem.image_url) ||
    cleanText(sourceItem.imageUrl)
  );
}

function createSlug(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 180);
}

function createSourceMaterial(sourceItem) {
  const keywords = Array.isArray(sourceItem.keywords)
    ? sourceItem.keywords
    : [];

  const suppliedContent =
    prepareSourceText(sourceItem.content) ||
    prepareSourceText(sourceItem.description) ||
    cleanText(sourceItem.title);

  const publishedAt = sourceItem.publishedAt || sourceItem.published_at || "";
  const sourceReferences = Array.isArray(sourceItem.sourceReferences)
    ? sourceItem.sourceReferences
    : [];
  const sourceList = sourceReferences.length
    ? sourceReferences
        .map(
          (reference) =>
            `- ${cleanText(reference.sourceName)}: ${cleanText(reference.sourceTitle)} (${cleanText(reference.sourceUrl)})`
        )
        .join("\n")
    : "- No additional source list supplied.";

  if (sourceItem.trustedCoverage) {
    return `
TRUSTED UPSC CURRENT-AFFAIRS SOURCE

SOURCE: ${cleanText(sourceItem.source) || "Trusted UPSC source"}
SOURCE URL: ${cleanText(sourceItem.url) || "Not supplied"}
PUBLISHED AT: ${cleanText(publishedAt) || "Not supplied"}
SOURCE TITLE: ${cleanText(sourceItem.title)}
SOURCE CATEGORY: ${cleanText(sourceItem.category) || "General"}
SOURCE PAPER: ${cleanText(sourceItem.paper) || "Prelims"}
KEYWORDS: ${keywords.join(", ")}

SOURCES CONSULTED

${sourceList}

COMPLETE EXTRACTED SOURCE CONTENT

${suppliedContent}

    `.trim();
  }

  return `
NEWS ARTICLE SOURCE

SOURCE TITLE: ${cleanText(sourceItem.title)}
SOURCE: ${cleanText(sourceItem.source) || "News source"}
SOURCE URL: ${cleanText(sourceItem.url) || "Not supplied"}
SOURCE CATEGORY: ${cleanText(sourceItem.category) || "General"}
KEYWORDS: ${keywords.join(", ")}
PUBLISHED AT: ${cleanText(publishedAt) || "Not supplied"}

COMPLETE EXTRACTED SOURCE CONTENT

${suppliedContent}
  `.trim();
}

function assertPublicOutput(article, stream) {
  const assessment = assessPublishedArticle(article, { stream });
  if (!assessment.allowed) {
    throw new Error(`PUBLICATION_BLOCKED: ${assessment.code}: ${assessment.reason}`);
  }
}

function existingArticleSourceMaterial(article, sourceItem) {
  return `
EXISTING CURRENTPULSE ARTICLE

TITLE
${cleanText(article.title)}

WHY IN NEWS
${cleanText(article.why_news)}

SYLLABUS LINKAGE
${cleanText(article.syllabus_linkage)}

INDIA RELEVANCE
${cleanText(article.india_relevance)}

STATIC FOUNDATION
${cleanText(article.static_foundation)}

DATA, REPORTS, CASES AND EXAMPLES
${cleanText(article.data_examples)}

PRELIMS
${cleanText(article.prelims)}

MAINS
${cleanText(article.mains)}

ANSWER FRAMEWORK
${cleanText(article.answer_framework)}

QUESTION
${cleanText(article.question)}

VISUAL SUMMARY
${cleanText(article.visual_summary)}

MEMORY TRICK
${cleanText(article.memory_trick)}

NEW TRUSTED COVERAGE INPUTS

${createSourceMaterial(sourceItem)}

Merge only the genuinely additional supported material into the existing
article. Preserve all useful existing facts and analysis. Remove repetition,
do not copy source wording, and do not introduce unsupported information.
  `.trim();
}

async function findExistingArticle(supabase, slug) {
  const { data, error } = await supabase
    .from("articles")
    .select("id, title, slug")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Article duplicate check failed: ${error.message}`
    );
  }

  return data || null;
}

async function createUniqueSlug(supabase, baseSlug, publishedAt) {
  const existing = await findExistingArticle(supabase, baseSlug);
  if (!existing) return baseSlug;

  const parsedDate = publishedAt ? new Date(publishedAt) : new Date();
  const dateSuffix = Number.isNaN(parsedDate.getTime())
    ? new Date().toISOString().slice(0, 10)
    : parsedDate.toISOString().slice(0, 10);
  const datedSlug = `${baseSlug.slice(0, 169)}-${dateSuffix}`;

  if (!(await findExistingArticle(supabase, datedSlug))) return datedSlug;

  return `${baseSlug.slice(0, 170)}-${Date.now().toString(36)}`;
}

export async function publishArticle(
  supabase,
  sourceItem
) {
  if (!sourceItem?.title) {
    throw new Error("Publishing source has no title.");
  }

  sourceItem = await enrichNewsSource(sourceItem);

  const generationMode = sourceItem.generationMode || "news";
  const sourceAssessment = sourceItem.trustedCoverage
    ? assessCoverageEventness(sourceItem)
    : assessNewsCandidate(sourceItem);
  if (!sourceAssessment.allowed) {
    throw new Error(`PUBLICATION_BLOCKED: ${sourceAssessment.code}: ${sourceAssessment.reason}`);
  }

  const registryDuplicate = await findExistingArticleByEventKey(supabase, sourceItem);
  if (registryDuplicate) {
    return { status: "duplicate", articleId: registryDuplicate.id, title: registryDuplicate.title, slug: registryDuplicate.slug };
  }

  // Same-event duplicate checks should stay within the active news cycle.
  // Very long lookbacks were both expensive and incorrectly suppressed genuine
  // later developments on the same broad topic.
  const duplicateWindow = sourceItem.trustedCoverage
    ? { lookbackDays: 45, limit: 650 }
    : { lookbackDays: 14, limit: 450 };
  const sourceDuplicate = await findDuplicateArticle(
    supabase,
    {
      title: sourceItem.title,
      description: sourceItem.description || sourceItem.content || "",
      publishedAt: sourceItem.publishedAt || sourceItem.published_at,
    },
    duplicateWindow
  );
  if (sourceDuplicate) {
    return {
      status: "duplicate",
      articleId: sourceDuplicate.id,
      title: sourceDuplicate.title,
      slug: sourceDuplicate.slug,
    };
  }

  const generatedArticle = await generateArticle(createSourceMaterial(sourceItem), {
    mode: generationMode,
    sourceTitle: sourceItem.title,
    sourceCategory: sourceItem.category,
    sourcePaper: sourceItem.paper,
    // Trusted coaching extracts may be converted into a source-grounded
    // emergency brief, but the publication quality gate below keeps sub-70
    // Current Affairs fallbacks pending until an AI provider becomes available.
    allowTrustedFallback: Boolean(sourceItem.trustedCoverage),
    // News fallback is also restricted to the retained source material; it
    // does not invent facts or silently promote News into UPSC CA.
    allowSourceFallback: generationMode === "news",
  });

  if (
    sourceItem.trustedCoverage &&
    generatedArticle.__sourceFallback &&
    Number(generatedArticle.quality?.score || 0) < 70
  ) {
    throw new Error(
      "AI temporarily unavailable: source-grounded Current Affairs fallback is below the public quality threshold and will be retried."
    );
  }

  enforceNumericGuard(sourceItem, generatedArticle, "new publication");
  assertPublicOutput(generatedArticle, sourceItem.trustedCoverage ? "coverage" : "news");

  if (generationMode === "news") {
    const newsOutput = assessNewsOutputQuality({
      ...generatedArticle,
      content: serializeNewsPresentation(generatedArticle),
    });
    if (!newsOutput.allowed) {
      throw new Error(`PUBLICATION_BLOCKED: ${newsOutput.code}: ${newsOutput.reason}`);
    }
  }

  const baseSlug = createSlug(generatedArticle.title);

  if (!baseSlug || baseSlug.length < 5) {
    throw new Error("Generated article has an invalid slug.");
  }

  const duplicateEvent = await findDuplicateArticle(
    supabase,
    {
      title: generatedArticle.title,
      description: `${generatedArticle.why_news} ${generatedArticle.prelims}`,
      publishedAt: sourceItem.publishedAt || sourceItem.published_at,
    },
    duplicateWindow
  );

  if (duplicateEvent) {
    return {
      status: "duplicate",
      articleId: duplicateEvent.id,
      title: duplicateEvent.title,
      slug: duplicateEvent.slug,
    };
  }

  const slug = await createUniqueSlug(
    supabase,
    baseSlug,
    sourceItem.publishedAt || sourceItem.published_at
  );

  const now = new Date().toISOString();
  const classificationText = [
    sourceItem.title,
    sourceItem.description,
    sourceItem.content,
    generatedArticle.title,
    generatedArticle.why_news,
    generatedArticle.prelims,
    generatedArticle.mains,
  ]
    .filter(Boolean)
    .join(" ");
  const taxonomy = generationMode === "news"
    ? {
        category: classifyNewsCategory(
          classificationText,
          generatedArticle.category || sourceItem.category
        ),
        paper: "Prelims",
      }
    : correctTaxonomy(
        classificationText,
        sourceItem.category || generatedArticle.category,
        generatedArticle.paper || sourceItem.paper
      );
  const { category, paper } = taxonomy;
  const licensedSourceImage = explicitlyLicensedSourceImage(sourceItem);
  const commonsImage = licensedSourceImage
    ? null
    : await findRelevantCommonsImage(
        generatedArticle.image_search_query,
        generatedArticle.title
      );
  const selectedImage =
    licensedSourceImage ||
    commonsImage?.url ||
    "";
  const resolvedImage = await persistRemoteArticleImage(
    supabase,
    selectedImage,
    slug
  );

  const articleData = {
    title: generatedArticle.title,
    slug,

    category,
    paper,

    content: generationMode === "news"
      ? serializeNewsPresentation(generatedArticle)
      : "",
    why_news: generatedArticle.why_news,
    syllabus_linkage: generatedArticle.syllabus_linkage,
    india_relevance: generatedArticle.india_relevance,
    static_foundation: generatedArticle.static_foundation,
    data_examples: generatedArticle.data_examples,
    prelims: generatedArticle.prelims,
    mains: generatedArticle.mains,
    answer_framework: generatedArticle.answer_framework,
    question: generatedArticle.question,
    image_search_query: generatedArticle.image_search_query,
    visual_summary: generatedArticle.visual_summary,
    memory_trick: generatedArticle.memory_trick,
    map_locations: generatedArticle.map_locations,

    image: resolvedImage || null,
    image_url: resolvedImage || null,
    image_alt: generatedArticle.title,
    image_caption: licensedSourceImage
      ? `${sourceItem.source || "Licensed source"} · ${cleanText(sourceItem.image_license || sourceItem.imageLicense || sourceItem.license)}`
      : commonsImage?.caption || null,
    image_source_url: licensedSourceImage
      ? cleanText(sourceItem.image_source_url || sourceItem.imageSourceUrl || sourceItem.url)
      : commonsImage?.sourceUrl || null,

    seo_title: generatedArticle.title,
    seo_description: stripHtml(
      generatedArticle.why_news
    ).slice(0, 155),

    quality_score: generatedArticle.quality?.score || 0,
    quality_flags: generatedArticle.quality?.flags || [],
    quality_version: generatedArticle.__sourceFallback ? 1 : 3,

    tags: Array.isArray(sourceItem.keywords)
      ? sourceItem.keywords
      : [],

    status: "published",
    created_at: now,
    updated_at: now,
  };

  const { data: publishedArticle, error: insertError } =
    await supabase
      .from("articles")
      .insert([articleData])
      .select()
      .single();

  if (insertError) {
    throw new Error(`Article insert failed: ${insertError.message}`);
  }

  await recordNewsSource(supabase, publishedArticle.id, publishedArticle.slug, sourceItem);

  // Alerts are best-effort and never block publishing. Current Affairs is
  // always eligible; general News is queued only when its quality score is
  // strong enough to avoid noisy subscriber notifications.
  if (sourceItem.trustedCoverage || Number(publishedArticle.quality_score || 0) >= 75) {
    await enqueueNotificationEvent(supabase, {
      entityKey: `article:${publishedArticle.id}:${sourceItem.trustedCoverage ? "current_affairs" : "news"}`,
      topic: sourceItem.trustedCoverage ? "current_affairs" : "news",
      title: publishedArticle.title,
      summary: publishedArticle.why_news,
      url: `${sourceItem.trustedCoverage ? "/current-affairs" : "/news"}/${publishedArticle.slug}`,
    });
  }

  return {
    status: generatedArticle.__sourceFallback
      ? "published_source_brief"
      : "published",
    articleId: publishedArticle.id,
    title: publishedArticle.title,
    slug: publishedArticle.slug,
    category: publishedArticle.category,
    paper: publishedArticle.paper,
  };
}

export async function attachNewsPresentationToExistingArticle(supabase, articleId, sourceItem = {}) {
  const { data: existingArticle, error: fetchError } = await supabase
    .from("articles")
    .select("*")
    .eq("id", articleId)
    .eq("status", "published")
    .maybeSingle();

  if (fetchError) {
    throw new Error(`Existing article fetch failed: ${fetchError.message}`);
  }
  if (!existingArticle) throw new Error("Published article was not found for news attachment.");

  let snapshot = parseNewsPresentation(existingArticle.content);
  const enrichedSourceItem = await enrichNewsSource(sourceItem);
  const sourceAssessment = assessNewsCandidate(enrichedSourceItem);
  if (!sourceAssessment.allowed) {
    throw new Error(`PUBLICATION_BLOCKED: ${sourceAssessment.code}: ${sourceAssessment.reason}`);
  }
  assertPublicOutput(existingArticle, "news");

  if (!snapshot) {
    const newsVersion = await generateArticle(createSourceMaterial(enrichedSourceItem), {
      mode: "news",
      sourceTitle: enrichedSourceItem.title || existingArticle.title,
      sourceCategory: enrichedSourceItem.category || existingArticle.category,
      sourcePaper: enrichedSourceItem.paper || existingArticle.paper,
      allowTrustedFallback: false,
    });
    assertPublicOutput(newsVersion, "news");
    const attachedQuality = assessNewsOutputQuality({
      ...newsVersion,
      content: serializeNewsPresentation(newsVersion),
    });
    if (!attachedQuality.allowed) {
      throw new Error(`PUBLICATION_BLOCKED: ${attachedQuality.code}: ${attachedQuality.reason}`);
    }

    const content = serializeNewsPresentation(newsVersion);
    const { error: updateError } = await supabase
      .from("articles")
      .update({ content, updated_at: new Date().toISOString() })
      .eq("id", existingArticle.id);

    if (updateError) {
      throw new Error(`News presentation update failed: ${updateError.message}`);
    }
    snapshot = parseNewsPresentation(content);
  }

  await recordNewsSource(
    supabase,
    existingArticle.id,
    existingArticle.slug,
    enrichedSourceItem
  );

  return {
    status: "news_attached",
    articleId: existingArticle.id,
    title: existingArticle.title,
    slug: existingArticle.slug,
    newsReady: Boolean(snapshot),
  };
}

export async function promotePublishedNewsToCurrentAffairs(supabase, articleId, sourceItem = {}) {
  const { data: existingArticle, error: fetchError } = await supabase
    .from("articles")
    .select("*")
    .eq("id", articleId)
    .eq("status", "published")
    .maybeSingle();

  if (fetchError) {
    throw new Error(`News promotion fetch failed: ${fetchError.message}`);
  }
  if (!existingArticle) throw new Error("Published news article was not found for UPSC promotion.");

  if (isStudyReady(existingArticle)) {
    return {
      status: "already_current_affairs",
      articleId: existingArticle.id,
      title: existingArticle.title,
      slug: existingArticle.slug,
      category: existingArticle.category,
      paper: existingArticle.paper,
    };
  }

  const enrichedSourceItem = await enrichNewsSource(sourceItem);
  const newsPresentation = parseNewsPresentation(existingArticle.content);
  const promotionSource = {
    ...enrichedSourceItem,
    content: [
      enrichedSourceItem.content || enrichedSourceItem.description || "",
      newsPresentation?.lead || "",
      newsPresentation?.keyFacts || "",
      newsPresentation?.context || "",
      newsPresentation?.whyItMatters || "",
    ]
      .filter(Boolean)
      .join("\n\n"),
  };

  const upscArticle = await generateArticle(createSourceMaterial(promotionSource), {
    mode: "upsc",
    sourceTitle: existingArticle.title,
    sourceCategory: enrichedSourceItem.category || existingArticle.category,
    sourcePaper: enrichedSourceItem.paper || existingArticle.paper,
    allowTrustedFallback: false,
  });
  assertPublicOutput({ ...upscArticle, title: existingArticle.title }, "coverage");

  const classificationText = [
    existingArticle.title,
    upscArticle.why_news,
    upscArticle.prelims,
    upscArticle.mains,
  ]
    .filter(Boolean)
    .join(" ");

  const taxonomy = correctTaxonomy(
    classificationText,
    existingArticle.category || upscArticle.category || enrichedSourceItem.category,
    upscArticle.paper || existingArticle.paper || enrichedSourceItem.paper
  );
  const { category, paper } = taxonomy;
  const now = new Date().toISOString();

  const { data: updatedArticle, error: updateError } = await supabase
    .from("articles")
    .update({
      category,
      paper,
      why_news: upscArticle.why_news,
      syllabus_linkage: upscArticle.syllabus_linkage,
      india_relevance: upscArticle.india_relevance,
      static_foundation: upscArticle.static_foundation,
      data_examples: upscArticle.data_examples,
      prelims: upscArticle.prelims,
      mains: upscArticle.mains,
      answer_framework: upscArticle.answer_framework,
      question: upscArticle.question,
      image_search_query: upscArticle.image_search_query,
      visual_summary: upscArticle.visual_summary,
      memory_trick: upscArticle.memory_trick,
      map_locations: upscArticle.map_locations,
      seo_description: stripHtml(upscArticle.why_news).slice(0, 155),
      quality_score: upscArticle.quality?.score || existingArticle.quality_score || 0,
      quality_flags: upscArticle.quality?.flags || existingArticle.quality_flags || [],
      quality_version: Math.max(Number(existingArticle.quality_version || 0), 3),
      updated_at: now,
    })
    .eq("id", existingArticle.id)
    .select()
    .single();

  if (updateError) {
    throw new Error(`News-to-current-affairs promotion failed: ${updateError.message}`);
  }

  return {
    status: "promoted_current_affairs",
    articleId: updatedArticle.id,
    title: updatedArticle.title,
    slug: updatedArticle.slug,
    category: updatedArticle.category,
    paper: updatedArticle.paper,
  };
}

export async function enrichPublishedArticle(supabase, articleId, sourceItem) {
  const { data: existingArticle, error: fetchError } = await supabase
    .from("articles")
    .select("*")
    .eq("id", articleId)
    .eq("status", "published")
    .maybeSingle();

  if (fetchError) {
    throw new Error(`Article enrichment fetch failed: ${fetchError.message}`);
  }
  if (!existingArticle) throw new Error("Published article was not found for enrichment.");

  const currentImage = isVerifiedReusableArticleImage(existingArticle)
    ? cleanText(existingArticle.image) || cleanText(existingArticle.image_url)
    : "";

  const enrichmentMaterial = existingArticleSourceMaterial(existingArticle, sourceItem);
  const enriched = await generateArticle(enrichmentMaterial, {
    mode: "trusted_coverage",
    sourceTitle: existingArticle.title,
    sourceCategory: existingArticle.category,
    sourcePaper: existingArticle.paper,
    allowTrustedFallback: false,
  });
  enforceNumericGuard({ title: existingArticle.title, content: enrichmentMaterial }, enriched, "article enrichment");
  assertPublicOutput({ ...enriched, title: existingArticle.title }, "coverage");

  const classificationText = [
    existingArticle.title,
    enriched.why_news,
    enriched.prelims,
    enriched.mains,
  ]
    .filter(Boolean)
    .join(" ");
  const taxonomy = correctTaxonomy(
    classificationText,
    existingArticle.category || enriched.category,
    existingArticle.paper || enriched.paper
  );
  const { category, paper } = taxonomy;
  const licensedSourceImage = explicitlyLicensedSourceImage(sourceItem);
  const commonsImage = currentImage || licensedSourceImage
    ? null
    : await findRelevantCommonsImage(
        enriched.image_search_query,
        existingArticle.title
      );
  const selectedImage = currentImage || licensedSourceImage || commonsImage?.url || "";
  const resolvedImage = await persistRemoteArticleImage(
    supabase,
    selectedImage,
    existingArticle.slug || existingArticle.title
  );
  const now = new Date().toISOString();

  const { data: updatedArticle, error: updateError } = await supabase
    .from("articles")
    .update({
      category,
      paper,
      why_news: enriched.why_news,
      syllabus_linkage: enriched.syllabus_linkage,
      india_relevance: enriched.india_relevance,
      static_foundation: enriched.static_foundation,
      data_examples: enriched.data_examples,
      prelims: enriched.prelims,
      mains: enriched.mains,
      answer_framework: enriched.answer_framework,
      question: enriched.question,
      image_search_query: enriched.image_search_query,
      visual_summary: enriched.visual_summary,
      memory_trick: enriched.memory_trick,
      map_locations: enriched.map_locations,
      image: resolvedImage || null,
      image_url: resolvedImage || null,
      image_alt: existingArticle.title,
      image_caption: currentImage
        ? existingArticle.image_caption
        : licensedSourceImage
          ? `${sourceItem.source || "Licensed source"} · ${cleanText(sourceItem.image_license || sourceItem.imageLicense || sourceItem.license)}`
          : commonsImage?.caption || null,
      image_source_url: currentImage
        ? existingArticle.image_source_url
        : licensedSourceImage
          ? cleanText(sourceItem.image_source_url || sourceItem.imageSourceUrl || sourceItem.url)
          : commonsImage?.sourceUrl || null,
      seo_description: stripHtml(enriched.why_news).slice(0, 155),
      quality_score: enriched.quality?.score || 0,
      quality_flags: enriched.quality?.flags || [],
      quality_version: 2,
      updated_at: now,
    })
    .eq("id", existingArticle.id)
    .select()
    .single();

  if (updateError) {
    throw new Error(`Article enrichment update failed: ${updateError.message}`);
  }

  return {
    status: "enriched",
    articleId: updatedArticle.id,
    title: updatedArticle.title,
    slug: updatedArticle.slug,
    category: updatedArticle.category,
    paper: updatedArticle.paper,
  };
}
