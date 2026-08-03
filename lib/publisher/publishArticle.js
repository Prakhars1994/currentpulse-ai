import { generateArticle } from "@/lib/ai/generateArticle";
import { findDuplicateArticle } from "@/lib/news/duplicateRepository";
import { classifyCategory, resolvePaper } from "@/lib/contentTaxonomy";
import { extractImageFromArticle } from "@/lib/news/imageExtractor";
import { resolvePublisherUrl } from "@/lib/news/publisherResolver";
import { persistRemoteArticleImage } from "@/lib/news/imageStorage";
import { getCategoryFallbackImage } from "@/lib/news/categoryImage";

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

function isGoogleNewsUrl(value = "") {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === "news.google.com" || hostname.endsWith(".news.google.com");
  } catch {
    return false;
  }
}

export async function discoverSourceImage(sourceItem) {
  const suppliedImage =
    cleanText(sourceItem.image) ||
    cleanText(sourceItem.image_url) ||
    cleanText(sourceItem.imageUrl);
  if (suppliedImage) return suppliedImage;

  const sourceUrl = cleanText(sourceItem.url);
  const sourceDomain = cleanText(sourceItem.source_domain || sourceItem.sourceDomain);
  const sourceTitle = cleanText(sourceItem.title);
  if (!sourceUrl) return "";

  if (isGoogleNewsUrl(sourceUrl) && sourceDomain && sourceTitle) {
    const publisherUrl = await resolvePublisherUrl(sourceTitle, sourceDomain);
    if (publisherUrl) {
      const publisherImage = await extractImageFromArticle(
        publisherUrl,
        sourceDomain,
        sourceTitle
      );
      if (publisherImage) return publisherImage;
    }
  }

  return extractImageFromArticle(sourceUrl, sourceDomain, sourceTitle);
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
    stripHtml(sourceItem.content) ||
    stripHtml(sourceItem.description) ||
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

This material was selected by a trusted UPSC current-affairs publisher.
Do not evaluate whether the topic is UPSC-relevant. Preserve every important
fact, date, statistic, report, Act, constitutional provision, judgment,
scheme, committee, institution, example, PYQ and analytical point supplied
above. Improve only grammar, English, sentence flow and organization. Do not
introduce unsupported information and do not omit important source content.
    `.trim();
  }

  return `
NEWS TITLE

${cleanText(sourceItem.title)}

NEWS DESCRIPTION

${suppliedContent}

SOURCE

${cleanText(sourceItem.source) || "News source"}

SOURCE URL

${cleanText(sourceItem.url) || "Not supplied"}

INITIAL UPSC EVALUATION

Category: ${cleanText(sourceItem.category) || "General"}
Paper: ${cleanText(sourceItem.paper) || "Prelims"}
Importance: ${sourceItem.importance || 10}/10
Reason: ${
    cleanText(sourceItem.evaluation_reason) ||
    "Important current-affairs development selected from a trusted source."
  }
Keywords: ${keywords.join(", ")}

Prepare an original CurrentPulse current-affairs article using the supplied
information. Do not invent unsupported facts.
  `.trim();
}

function existingArticleSourceMaterial(article, sourceItem) {
  return `
EXISTING CURRENTPULSE ARTICLE

TITLE
${cleanText(article.title)}

WHY IN NEWS
${cleanText(article.why_news)}

PRELIMS
${cleanText(article.prelims)}

MAINS
${cleanText(article.mains)}

QUESTION
${cleanText(article.question)}

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

  const [generatedArticle, discoveredImage] = await Promise.all([
    generateArticle(createSourceMaterial(sourceItem), {
      mode: sourceItem.generationMode || "news",
      sourceTitle: sourceItem.title,
      sourceCategory: sourceItem.category,
      sourcePaper: sourceItem.paper,
    }),
    discoverSourceImage(sourceItem),
  ]);

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
    { lookbackDays: 30, limit: 700 }
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
  const category = classifyCategory(
    classificationText,
    sourceItem.category || generatedArticle.category
  );
  const paper = resolvePaper(category, generatedArticle.paper || sourceItem.paper);
  const selectedImage =
    discoveredImage || getCategoryFallbackImage(category, generatedArticle.title);
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

    content: "",
    why_news: generatedArticle.why_news,
    prelims: generatedArticle.prelims,
    mains: generatedArticle.mains,
    question: generatedArticle.question,

    image: resolvedImage || null,
    image_url: resolvedImage || null,
    image_alt: generatedArticle.title,
    image_caption:
      sourceItem.source || "Current Affairs",

    seo_title: generatedArticle.title,
    seo_description: stripHtml(
      generatedArticle.why_news
    ).slice(0, 160),

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
    throw new Error(
      `Article insert failed: ${insertError.message}`
    );
  }

  return {
    status: "published",
    articleId: publishedArticle.id,
    title: publishedArticle.title,
    slug: publishedArticle.slug,
    category: publishedArticle.category,
    paper: publishedArticle.paper,
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

  const currentImage =
    cleanText(existingArticle.image) || cleanText(existingArticle.image_url);

  const [enriched, discoveredImage] = await Promise.all([
    generateArticle(existingArticleSourceMaterial(existingArticle, sourceItem), {
      mode: "trusted_coverage",
      sourceTitle: existingArticle.title,
      sourceCategory: existingArticle.category,
      sourcePaper: existingArticle.paper,
    }),
    currentImage ? Promise.resolve(currentImage) : discoverSourceImage(sourceItem),
  ]);

  const classificationText = [
    existingArticle.title,
    enriched.why_news,
    enriched.prelims,
    enriched.mains,
  ]
    .filter(Boolean)
    .join(" ");
  const category = classifyCategory(
    classificationText,
    existingArticle.category || enriched.category
  );
  const paper = resolvePaper(category, existingArticle.paper || enriched.paper);
  const selectedImage =
    currentImage ||
    discoveredImage ||
    getCategoryFallbackImage(category, existingArticle.title);
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
      prelims: enriched.prelims,
      mains: enriched.mains,
      question: enriched.question,
      image: resolvedImage || null,
      image_url: resolvedImage || null,
      seo_description: stripHtml(enriched.why_news).slice(0, 160),
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
