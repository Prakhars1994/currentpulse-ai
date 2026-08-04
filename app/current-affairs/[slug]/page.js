import { supabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import Link from "next/link";
import ArticleViewTracker from "@/components/ArticleViewTracker";
import ArticleContent from "@/components/ArticleContent";
import { resolveDisplayImage } from "@/lib/news/categoryImage";
import ArticleStudyVisuals from "@/components/ArticleStudyVisuals";
import RelatedYouTubeVideo from "@/components/RelatedYouTubeVideo";
import { SITE_URL, absoluteSiteUrl } from "@/lib/siteUrl";

// Remove HTML tags for SEO descriptions and reading-time calculation
function stripHtml(html = "") {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function calculateReadingTime(article) {
  const text = [
    article?.why_news,
    article?.syllabus_linkage,
    article?.india_relevance,
    article?.static_foundation,
    article?.data_examples,
    article?.prelims,
    article?.mains,
    article?.answer_framework,
    article?.question,
  ]
    .filter(Boolean)
    .map(stripHtml)
    .join(" ");

  const words = text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  return Math.max(1, Math.ceil(words / 200));
}

function formatDate(date) {
  if (!date) {
    return "";
  }

  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function absoluteImageUrl(value) {
  return value ? absoluteSiteUrl(value) : "";
}

// ============================
// Dynamic SEO
// ============================

export async function generateMetadata({ params }) {
  const { slug } = await params;

  const { data: article } = await supabase
    .from("articles")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (!article) {
    return {
      title: "Article Not Found | CurrentPulse AI",
      description:
        "Daily UPSC Current Affairs Analysis, Editorials, Prelims, Mains and PYQs.",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const image = absoluteImageUrl(resolveDisplayImage(article));

  const plainDescription =
    stripHtml(article.seo_description || "") ||
    stripHtml(article.why_news || "").slice(0, 160) ||
    "UPSC Current Affairs";

  return {
    title: article.seo_title || article.title,
    description: plainDescription,

    keywords: Array.isArray(article.tags)
      ? article.tags.join(", ")
      : article.tags || "",

    alternates: {
      canonical: `${SITE_URL}/current-affairs/${slug}`,
    },

    openGraph: {
      title: article.title,
      description: plainDescription,
      url: `${SITE_URL}/current-affairs/${slug}`,
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
        },
      ],
      type: "article",
      publishedTime: article.created_at,
      modifiedTime: article.updated_at || article.created_at,
      section: article.category || "UPSC Current Affairs",
      authors: ["CurrentPulse Editorial Desk"],
    },

    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: plainDescription,
      images: [image],
    },
    authors: [{ name: "CurrentPulse Editorial Desk", url: SITE_URL }],
    category: "education",
    robots: { index: true, follow: true },
  };
}

// ============================
// Article Page
// ============================

export default async function ArticlePage({ params }) {
  const { slug } = await params;

  const { data: article, error: articleError } = await supabase
    .from("articles")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (articleError) {
    console.error("Article fetch error:", articleError);
  }

  if (!article) {
    notFound();
  }

  const readingTime = calculateReadingTime(article);

  const { data: articleSources, error: sourcesError } = await supabase
    .from("article_sources")
    .select("id, source_name, source_title, source_url, source_published_at")
    .eq("article_id", article.id)
    .order("created_at", { ascending: true });

  if (sourcesError && sourcesError.code !== "42P01") {
    console.error("Article sources fetch error:", sourcesError);
  }

  // Only published related articles
  const { data: relatedArticles, error: relatedError } = await supabase
    .from("articles")
    .select("id,title,slug,category,created_at")
    .eq("status", "published")
    .eq("category", article.category)
    .neq("slug", slug)
    .order("created_at", { ascending: false })
    .limit(3);

  if (relatedError) {
    console.error("Related articles fetch error:", relatedError);
  }

  // Only published previous article
  const { data: previousArticle, error: previousError } = await supabase
    .from("articles")
    .select("title,slug")
    .eq("status", "published")
    .lt("id", article.id)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (previousError) {
    console.error("Previous article fetch error:", previousError);
  }


  // Only published next article
  const { data: nextArticle, error: nextError } = await supabase
    .from("articles")
    .select("title,slug")
    .eq("status", "published")
    .gt("id", article.id)
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (nextError) {
    console.error("Next article fetch error:", nextError);
  }

  const articleImage = resolveDisplayImage(article);

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [{
    "@type": "NewsArticle",
    "@id": `${SITE_URL}/current-affairs/${slug}#article`,
    headline: article.title,
    description:
      stripHtml(article.seo_description || "") ||
      stripHtml(article.why_news || ""),
    image: [absoluteImageUrl(articleImage)],
    datePublished: article.created_at,
    dateModified: article.updated_at || article.created_at,
    author: {
      "@type": "Organization",
      name: "CurrentPulse AI",
      url: SITE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: "CurrentPulse AI",
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/icon.svg`,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${SITE_URL}/current-affairs/${slug}`,
    },
    articleSection: article.category || "UPSC Current Affairs",
    keywords: Array.isArray(article.tags) ? article.tags.join(", ") : article.tags || article.category,
    isAccessibleForFree: true,
    citation: (articleSources || []).map((source) => source.source_url).filter(Boolean),
    about: [article.category, article.paper].filter(Boolean).map((name) => ({ "@type": "Thing", name })),
  }, {
    "@type": "BreadcrumbList",
    "@id": `${SITE_URL}/current-affairs/${slug}#breadcrumb`,
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Current Affairs", item: `${SITE_URL}/current-affairs` },
      { "@type": "ListItem", position: 3, name: article.title, item: `${SITE_URL}/current-affairs/${slug}` },
    ],
  }],
  };

  return (
    <>
      <ArticleViewTracker slug={slug} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData),
        }}
      />

      <main className="min-h-screen bg-slate-950 text-slate-100">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">

        <nav className="mb-6 text-sm text-slate-400">
          <Link href="/" className="hover:text-cyan-300">
            Home
          </Link>

          {" / "}

          <Link
            href="/current-affairs"
            className="hover:text-cyan-300"
          >
            Current Affairs
          </Link>

          {" / "}

          <span>{article.title}</span>
        </nav>

        <h1 className="text-3xl font-extrabold leading-tight text-white sm:text-5xl">
          {article.title}
        </h1>

        <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-slate-300">

          <span>
            📅 Published {formatDate(article.created_at)}
          </span>

          {article.updated_at && article.updated_at !== article.created_at && (
            <><span>•</span><span>Updated {formatDate(article.updated_at)}</span></>
          )}

          <span>•</span>

          <span>
            ⏱ {readingTime} min read
          </span>

          <span>•</span>

          <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">
            {article.category}
          </span>

          <span className="bg-green-100 text-green-700 px-2 py-1 rounded">
            {article.paper}
          </span>

        </div>

        {articleImage && (
          <figure className="article-hero-visual">
            <img
              src={articleImage}
              alt={article.image_alt || article.title}
              className="article-hero-image"
            />
            {article.image_caption && (
              <figcaption>
                <span>{article.image_caption}</span>
                {article.image_source_url && (
                  <a
                    href={article.image_source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Image source ↗
                  </a>
                )}
              </figcaption>
            )}
          </figure>
        )}

        <nav className="article-jump-nav" aria-label="Article sections">
          <span>Jump to</span>
          <a href="#why-in-news">News</a>
          <a href="#syllabus">Syllabus</a>
          {article.static_foundation && <a href="#static-foundation">Static</a>}
          {article.data_examples && <a href="#evidence">Evidence</a>}
          <a href="#prelims">Prelims</a>
          <a href="#mains">Mains</a>
          {article.answer_framework && <a href="#answer-framework">Answer plan</a>}
        </nav>

        <article className="mt-10 space-y-8">

          <section id="why-in-news" className="article-section article-section--context scroll-mt-28">
            <h2 className="article-section-title text-purple-200">📌 Why in News?</h2>
            <ArticleContent
              content={article.why_news}
              fallback="Why in News will be updated soon."
            />
          </section>

          <section id="syllabus" className="article-section article-section--syllabus scroll-mt-28">
            <h2 className="article-section-title">🎯 Syllabus & Exam Relevance</h2>
            <ArticleContent
              content={article.syllabus_linkage || `- **Paper:** ${article.paper || "General Studies"}\n- **Theme:** ${article.category || "Current Affairs"}`}
            />
            {article.india_relevance && (
              <div className="article-relevance-callout">
                <h3>Why it matters for India</h3>
                <ArticleContent content={article.india_relevance} />
              </div>
            )}
          </section>

          {article.static_foundation && (
            <section id="static-foundation" className="article-section article-section--static scroll-mt-28">
              <h2 className="article-section-title">🏛️ Static Foundation</h2>
              <ArticleContent content={article.static_foundation} />
            </section>
          )}

          {article.data_examples && (
            <section id="evidence" className="article-section article-section--evidence scroll-mt-28">
              <h2 className="article-section-title">📊 Data, Reports, Cases & Examples</h2>
              <ArticleContent content={article.data_examples} />
            </section>
          )}

          <ArticleStudyVisuals
            mapLocations={article.map_locations}
          />

          <section id="prelims" className="article-section article-section--prelims scroll-mt-28">
            <h2 className="article-section-title">📚 Prelims Toolkit</h2>
            <ArticleContent
              content={article.prelims}
              fallback="Prelims facts will be updated soon."
            />
          </section>

          <section id="mains" className="article-section article-section--mains scroll-mt-28">
            <h2 className="article-section-title">✍️ Mains Perspective</h2>
            <ArticleContent
              content={article.mains}
              fallback="Detailed Mains analysis will be updated soon."
            />
          </section>

          {article.answer_framework && (
            <section id="answer-framework" className="article-section article-section--answer scroll-mt-28">
              <h2 className="article-section-title">🧭 Mains Answer Framework</h2>
              <ArticleContent content={article.answer_framework} />
            </section>
          )}

          <section className="article-section border-blue-500/30 bg-blue-500/10">
            <h2 className="article-section-title text-blue-200">📝 Possible UPSC Mains Question</h2>
            <div className="rounded-xl border-l-4 border-blue-400 bg-slate-900/80 p-6 text-lg leading-8 text-slate-100">
              <ArticleContent
                content={article.question}
                fallback="Discuss the significance of this topic for India."
              />
            </div>
          </section>

        </article>

        <RelatedYouTubeVideo
          title={article.title}
          category={article.category}
        />

        {articleSources?.length > 0 && (
          <section className="mt-10 rounded-2xl border border-slate-700 bg-slate-900/70 p-6">
            <h2 className="text-xl font-bold text-cyan-300">
              🔎 Sources consulted
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              This CurrentPulse analysis synthesizes unique exam-relevant inputs from the following sources.
            </p>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {articleSources.map((source) => (
                <li key={source.id}>
                  <a
                    href={source.source_url}
                    target="_blank"
                rel="noopener noreferrer"
                    className="block rounded-xl border border-slate-700 bg-slate-950/70 p-4 transition hover:border-cyan-500"
                  >
                    <span className="font-bold text-cyan-300">
                      {source.source_name}
                    </span>
                    {source.source_title && (
                      <span className="mt-1 block text-sm leading-6 text-slate-300">
                        {source.source_title}
                      </span>
                    )}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-14">
          <h2 className="text-2xl font-bold mb-5">
            📤 Share this Article
          </h2>

          <div className="flex flex-wrap gap-3">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(
                `${article.title} ${SITE_URL}/current-affairs/${article.slug}`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-green-600 px-5 py-3 font-semibold text-white"
            >
              WhatsApp
            </a>

            <a
              href={`https://t.me/share/url?url=${encodeURIComponent(
                `${SITE_URL}/current-affairs/${article.slug}`
              )}&text=${encodeURIComponent(article.title)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-sky-500 px-5 py-3 font-semibold text-white"
            >
              Telegram
            </a>

            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                article.title
              )}&url=${encodeURIComponent(
                  `${SITE_URL}/current-affairs/${article.slug}`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-black px-5 py-3 font-semibold text-white"
            >
              X
            </a>

            <a
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
                `${SITE_URL}/current-affairs/${article.slug}`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white"
            >
              LinkedIn
            </a>
          </div>
        </section>

        <section className="mt-14">
          <Link
            href={`/ai?topic=${encodeURIComponent(article.title)}`}
            className="block w-full rounded-xl bg-gradient-to-r from-cyan-600 to-blue-700 py-5 text-center text-lg font-bold text-white transition hover:from-cyan-500 hover:to-blue-600"
          >
            🤖 Ask CurrentPulse AI About This Topic
          </Link>
        </section>

        {(previousArticle || nextArticle) && (
          <section className="mt-20 grid gap-6 md:grid-cols-2">

            {previousArticle ? (
              <Link
                href={`/current-affairs/${previousArticle.slug}`}
                className="rounded-xl border border-slate-700 bg-slate-900/70 p-6 transition hover:border-cyan-400 hover:bg-slate-900 hover:shadow-lg"
              >
                <p className="mb-2 text-sm text-slate-400">
                  ← Previous Article
                </p>

                <h3 className="font-bold text-slate-100">
                  {previousArticle.title}
                </h3>
              </Link>
            ) : (
              <div />
            )}

            {nextArticle ? (
              <Link
                href={`/current-affairs/${nextArticle.slug}`}
                className="rounded-xl border border-slate-700 bg-slate-900/70 p-6 text-right transition hover:border-cyan-400 hover:bg-slate-900 hover:shadow-lg"
              >
                <p className="mb-2 text-sm text-slate-400">
                  Next Article →
                </p>

                <h3 className="font-bold text-slate-100">
                  {nextArticle.title}
                </h3>
              </Link>
            ) : (
              <div />
            )}

          </section>
        )}

        {relatedArticles?.length > 0 && (
          <section className="mt-20">

            <h2 className="mb-8 text-3xl font-bold">
              Related Articles
            </h2>

            <div className="grid gap-6 md:grid-cols-3">

              {relatedArticles.map((item) => (
                <Link
                  key={item.id}
                  href={`/current-affairs/${item.slug}`}
                  className="rounded-xl border border-slate-700 bg-slate-900/70 p-5 transition hover:border-cyan-400 hover:bg-slate-900 hover:shadow-lg"
                >
                  <span className="text-sm font-semibold text-cyan-300">
                    {item.category}
                  </span>

                  <h3 className="mt-3 font-bold leading-6 text-slate-100">
                    {item.title}
                  </h3>

                  <p className="mt-4 text-sm text-slate-400">
                    {formatDate(item.created_at)}
                  </p>
                </Link>
              ))}

            </div>

          </section>
        )}

        </div>
      </main>
    </>
  );
}
