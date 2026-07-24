import { supabase } from "@/lib/supabase";
import { notFound } from "next/navigation";
import Link from "next/link";
import ArticleViewTracker from "@/components/ArticleViewTracker";

const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

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

  const image =
    article.image_url ||
    "https://images.unsplash.com/photo-1451187580459-43490279c0fa";

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

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",

    headline: article.title,

    description:
      stripHtml(article.seo_description || "") ||
      stripHtml(article.why_news || ""),

    image: article.image_url
      ? [article.image_url]
      : [
          "https://images.unsplash.com/photo-1451187580459-43490279c0fa",
        ],

    author: {
      "@type": "Organization",
      name: "CurrentPulse AI",
    },

    publisher: {
      "@type": "Organization",
      name: "CurrentPulse AI",
    },

    datePublished: article.created_at,

    dateModified: article.updated_at || article.created_at,

    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${BASE_URL}/current-affairs/${article.slug}`,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(articleSchema),
        }}
      />

      <main className="min-h-screen bg-slate-100 py-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          {/* Breadcrumb */}
          <div className="mb-8 text-sm text-gray-500">
            <Link href="/" className="hover:text-blue-600">
              Home
            </Link>

            {" / "}

            <Link
              href="/current-affairs"
              className="hover:text-blue-600"
            >
              Current Affairs
            </Link>

            {" / "}

            <Link
              href={`/current-affairs/category/${encodeURIComponent(
                article.category
              )}`}
              className="hover:text-blue-600"
            >
              {article.category}
            </Link>

            {" / "}

            <span className="text-gray-700">
              {article.title}
            </span>
          </div>

          {/* Article Card */}
          <article className="overflow-hidden rounded-3xl bg-white shadow-lg">
            {article.image_url && (
              <img
                src={article.image_url}
                alt={article.title}
                className="h-[240px] w-full object-cover sm:h-[340px] lg:h-[420px]"
              />
            )}

            <div className="p-6 sm:p-8 lg:p-10">
              {/* Category */}
              <span className="inline-flex rounded-full bg-cyan-600 px-4 py-2 font-semibold text-white">
                {article.category}
              </span>

              {/* Title */}
              <h1 className="mt-6 break-words text-3xl font-extrabold leading-tight text-gray-900 sm:text-4xl lg:text-5xl">
                {article.title}
              </h1>

              {/* Meta */}
              <div className="mt-8 flex flex-wrap gap-3 text-sm">
                {article.paper && (
                  <span className="rounded-full bg-blue-600 px-4 py-2 text-white">
                    {article.paper}
                  </span>
                )}

                <span className="rounded-full bg-emerald-600 px-4 py-2 text-white">
                  {readingTime} min read
                </span>

                <span className="rounded-full bg-orange-500 px-4 py-2 text-white">
                  Published {formatDate(article.created_at)}
                </span>

                <ArticleViewTracker
                  slug={article.slug}
                  initialViews={article.views || 0}
                />
              </div>

              <hr className="my-10 border-gray-200" />

              {/* Why in News */}
              <section>
                <h2 className="mb-5 text-2xl font-bold text-gray-900 sm:text-3xl">
                  📌 Why in News?
                </h2>

                <div
                  className="prose prose-lg max-w-none leading-8 text-gray-700"
                  dangerouslySetInnerHTML={{
                    __html:
                      article.why_news ||
                      "<p>Why in News will be updated soon.</p>",
                  }}
                />
              </section>

              {/* UPSC Relevance */}
              <section className="mt-14">
                <h2 className="mb-5 text-2xl font-bold text-gray-900 sm:text-3xl">
                  🎯 UPSC Relevance
                </h2>

                <div className="rounded-xl border border-blue-100 bg-blue-50 p-6">
                  <ul className="space-y-3 text-lg text-gray-800">
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

              {/* Prelims */}
              <section className="mt-14">
                <h2 className="mb-5 text-2xl font-bold text-gray-900 sm:text-3xl">
                  📚 Prelims Facts
                </h2>

                <div className="rounded-xl border border-gray-200 bg-gray-50 p-6">
                  <div
                    className="prose prose-lg max-w-none leading-8 text-gray-700"
                    dangerouslySetInnerHTML={{
                      __html:
                        article.prelims ||
                        "<p>Prelims facts will be updated soon.</p>",
                    }}
                  />
                </div>
              </section>

              {/* Mains */}
              <section className="mt-14">
                <h2 className="mb-5 text-2xl font-bold text-gray-900 sm:text-3xl">
                  ✍️ Mains Perspective
                </h2>

                <div className="rounded-xl border border-gray-200 bg-gray-50 p-6">
                  <div
                    className="prose prose-lg max-w-none leading-8 text-gray-700"
                    dangerouslySetInnerHTML={{
                      __html:
                        article.mains ||
                        "<p>Detailed Mains analysis will be updated soon.</p>",
                    }}
                  />
                </div>
              </section>

              {/* UPSC Question */}
              <section className="mt-14">
                <h2 className="mb-5 text-2xl font-bold text-gray-900 sm:text-3xl">
                  📝 Possible UPSC Mains Question
                </h2>

                <div className="rounded-xl border-l-4 border-blue-600 bg-blue-50 p-6">
                  <div
                    className="prose prose-lg max-w-none leading-8 text-gray-800"
                    dangerouslySetInnerHTML={{
                      __html:
                        article.question ||
                        "<p>Discuss the significance of this topic for India.</p>",
                    }}
                  />
                </div>
              </section>

              {/* Share */}
              <section className="mt-16">
                <h2 className="mb-5 text-2xl font-bold text-gray-900">
                  📤 Share this Article
                </h2>

                <div className="flex flex-wrap gap-4">
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(
                      `${article.title} ${BASE_URL}/current-affairs/${article.slug}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg bg-green-600 px-5 py-3 font-semibold text-white transition hover:bg-green-700"
                  >
                    WhatsApp
                  </a>

                  <a
                    href={`https://t.me/share/url?url=${encodeURIComponent(
                      `${BASE_URL}/current-affairs/${article.slug}`
                    )}&text=${encodeURIComponent(article.title)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg bg-sky-500 px-5 py-3 font-semibold text-white transition hover:bg-sky-600"
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
                    className="rounded-lg bg-black px-5 py-3 font-semibold text-white transition hover:opacity-80"
                  >
                    X
                  </a>

                  <a
                    href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
                      `${BASE_URL}/current-affairs/${article.slug}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white transition hover:bg-blue-800"
                  >
                    LinkedIn
                  </a>
                </div>
              </section>

              {/* AI Button */}
              <section className="mt-16">
                <button
                  type="button"
                  className="w-full rounded-xl bg-gradient-to-r from-cyan-600 to-blue-700 py-5 text-lg font-bold text-white transition hover:opacity-90 sm:text-xl"
                >
                  🤖 Ask CurrentPulse AI About This Topic
                </button>
              </section>

              {/* Previous / Next */}
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

              {/* Related Articles */}
              {relatedArticles?.length > 0 && (
                <section className="mt-20">
                  <h2 className="mb-8 text-2xl font-bold text-gray-900 sm:text-3xl">
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
          </article>
        </div>
      </main>
    </>
  );
}