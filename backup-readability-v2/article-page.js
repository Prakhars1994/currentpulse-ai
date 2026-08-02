import { supabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import Link from "next/link";
import ArticleViewTracker from "@/components/ArticleViewTracker";
import ArticleContent from "@/components/ArticleContent";

const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

const DEFAULT_ARTICLE_IMAGE =
  "https://images.unsplash.com/photo-1451187580459-43490279c0fa";

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
    article?.prelims,
    article?.mains,
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

  const image = article.image || DEFAULT_ARTICLE_IMAGE;

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
      canonical: `${BASE_URL}/current-affairs/${slug}`,
    },

    openGraph: {
      title: article.title,
      description: plainDescription,
      url: `${BASE_URL}/current-affairs/${slug}`,
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
    },

    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: plainDescription,
      images: [image],
    },
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

  const articleImage = article.image || DEFAULT_ARTICLE_IMAGE;

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    description:
      stripHtml(article.seo_description || "") ||
      stripHtml(article.why_news || ""),
    image: [articleImage],
    datePublished: article.created_at,
    dateModified: article.updated_at || article.created_at,
    author: {
      "@type": "Organization",
      name: "CurrentPulse AI",
    },
    publisher: {
      "@type": "Organization",
      name: "CurrentPulse AI",
      logo: {
        "@type": "ImageObject",
        url: `${BASE_URL}/logo.png`,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${BASE_URL}/current-affairs/${slug}`,
    },
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
            📅 {formatDate(article.created_at)}
          </span>

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

        {article.image && (
          <img
            src={article.image}
            alt={article.title}
            className="w-full rounded-xl mt-8 mb-8 shadow-lg object-cover max-h-[500px]"
          />
        )}
        <article className="mt-10 space-y-8">

          <section className="article-section border-purple-500/30 bg-purple-500/10">
            <h2 className="article-section-title text-purple-200">📌 Why in News?</h2>
            <ArticleContent
              content={article.why_news}
              fallback="Why in News will be updated soon."
            />
          </section>

          <section className="article-section">
            <h2 className="article-section-title">🎯 UPSC Relevance</h2>

            <div className="rounded-xl border border-cyan-400/20 bg-slate-900/80 p-6">
              <ul className="space-y-3 text-slate-100">
                <li>
                  <strong>Paper:</strong>{" "}
                  {article.paper || "Not specified"}
                </li>

                <li>
                  <strong>Category:</strong>{" "}
                  {article.category || "Not specified"}
                </li>

                <li>
                  Important for UPSC Civil Services Examination.
                </li>
              </ul>
            </div>
          </section>

          <section className="article-section">
            <h2 className="article-section-title">📚 Prelims Facts</h2>
            <ArticleContent
              content={article.prelims}
              fallback="Prelims facts will be updated soon."
            />
          </section>

          <section className="article-section">
            <h2 className="article-section-title">✍️ Mains Perspective</h2>
            <ArticleContent
              content={article.mains}
              fallback="Detailed Mains analysis will be updated soon."
            />
          </section>

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

        <section className="mt-14">
          <h2 className="text-2xl font-bold mb-5">
            📤 Share this Article
          </h2>

          <div className="flex flex-wrap gap-3">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(
                `${article.title} ${BASE_URL}/current-affairs/${article.slug}`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-green-600 px-5 py-3 font-semibold text-white"
            >
              WhatsApp
            </a>

            <a
              href={`https://t.me/share/url?url=${encodeURIComponent(
                `${BASE_URL}/current-affairs/${article.slug}`
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
                `${BASE_URL}/current-affairs/${article.slug}`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-black px-5 py-3 font-semibold text-white"
            >
              X
            </a>

            <a
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
                `${BASE_URL}/current-affairs/${article.slug}`
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
          <button
            type="button"
            className="w-full rounded-xl bg-gradient-to-r from-cyan-600 to-blue-700 py-5 text-lg font-bold text-white"
          >
            🤖 Ask CurrentPulse AI About This Topic
          </button>
        </section>

        {(previousArticle || nextArticle) && (
          <section className="mt-20 grid gap-6 md:grid-cols-2">

            {previousArticle ? (
              <Link
                href={`/current-affairs/${previousArticle.slug}`}
                className="rounded-xl border border-gray-200 p-6 transition hover:border-blue-300 hover:shadow-lg"
              >
                <p className="mb-2 text-sm text-gray-500">
                  ← Previous Article
                </p>

                <h3 className="font-bold text-gray-900">
                  {previousArticle.title}
                </h3>
              </Link>
            ) : (
              <div />
            )}

            {nextArticle ? (
              <Link
                href={`/current-affairs/${nextArticle.slug}`}
                className="rounded-xl border border-gray-200 p-6 text-right transition hover:border-blue-300 hover:shadow-lg"
              >
                <p className="mb-2 text-sm text-gray-500">
                  Next Article →
                </p>

                <h3 className="font-bold text-gray-900">
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
                  className="rounded-xl border border-gray-200 p-5 transition hover:border-cyan-300 hover:shadow-lg"
                >
                  <span className="text-sm font-medium text-cyan-600">
                    {item.category}
                  </span>

                  <h3 className="mt-3 font-bold text-gray-900">
                    {item.title}
                  </h3>

                  <p className="mt-4 text-sm text-gray-500">
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