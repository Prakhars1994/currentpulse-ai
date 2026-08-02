import { generateArticle } from "@/lib/ai/generateArticle";

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

  return `
NEWS TITLE

${cleanText(sourceItem.title)}

NEWS DESCRIPTION

${stripHtml(sourceItem.description) || cleanText(sourceItem.title)}

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

export async function publishArticle(
  supabase,
  sourceItem
) {
  if (!sourceItem?.title) {
    throw new Error("Publishing source has no title.");
  }

  const generatedArticle = await generateArticle(
    createSourceMaterial(sourceItem)
  );

  const slug = createSlug(generatedArticle.title);

  if (!slug || slug.length < 5) {
    throw new Error("Generated article has an invalid slug.");
  }

  const existingArticle = await findExistingArticle(
    supabase,
    slug
  );

  if (existingArticle) {
    return {
      status: "duplicate",
      articleId: existingArticle.id,
      title: existingArticle.title,
      slug: existingArticle.slug,
    };
  }

  const now = new Date().toISOString();

  const articleData = {
    title: generatedArticle.title,
    slug,

    category:
      generatedArticle.category ||
      sourceItem.category ||
      "General",

    paper:
      generatedArticle.paper ||
      sourceItem.paper ||
      "Prelims",

    content: "",
    why_news: generatedArticle.why_news,
    prelims: generatedArticle.prelims,
    mains: generatedArticle.mains,
    question: generatedArticle.question,

    image_url: sourceItem.image_url || null,
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