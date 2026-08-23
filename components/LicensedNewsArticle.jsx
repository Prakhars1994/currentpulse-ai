import Link from "next/link";
import ArticleViewTracker from "@/components/ArticleViewTracker";
import { SITE_URL } from "@/lib/siteUrl";

function stripHtml(value = "") {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function tagged(article, prefix) {
  return (Array.isArray(article.tags) ? article.tags : [])
    .filter((tag) => String(tag).startsWith(prefix))
    .map((tag) => String(tag).slice(prefix.length).trim())
    .filter(Boolean);
}

export default function LicensedNewsArticle({ article, sources = [] }) {
  const source =
    sources.find(
      (item) =>
        item.source_kind === "news" &&
        item.source_name === "The Conversation"
    ) || sources.find((item) => item.source_kind === "news");

  const authors = tagged(article, "conversation-author:");
  const institutions = tagged(article, "conversation-institution:");
  const canonical = `${SITE_URL}/news/${article.slug}`;

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title,
    description: stripHtml(article.why_news),
    datePublished: article.created_at,
    dateModified: article.updated_at || article.created_at,
    mainEntityOfPage: canonical,
    author: authors.length
      ? authors.map((name) => ({ "@type": "Person", name }))
      : [{ "@type": "Organization", name: "The Conversation" }],
    publisher: {
      "@type": "Organization",
      name: "CurrentPulse AI",
      url: SITE_URL,
    },
    citation: source?.source_url ? [source.source_url] : [],
  };

  return (
    <>
      <ArticleViewTracker slug={article.slug} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <main className="news-article-page min-h-screen">
        <article className="news-article-shell">
          <nav className="news-article-breadcrumb">
            <Link href="/">Home</Link> / <Link href="/news">News</Link> /{" "}
            <span>{article.category || "News"}</span>
          </nav>

          <p className="news-article-category">
            The Conversation · Republished article
          </p>

          <h1>{article.title}</h1>

          <div className="news-article-byline">
            <span>{authors.length ? authors.join(", ") : "The Conversation"}</span>
            {institutions.length ? <span>{institutions.join(" · ")}</span> : null}
            <time>Published {formatDate(article.created_at)}</time>
          </div>

          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-950">
            This article is reproduced from{" "}
            <a
              href={source?.source_url || "https://theconversation.com"}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold underline"
            >
              The Conversation
            </a>{" "}
            under its Creative Commons republication terms. The article text
            below is not rewritten by CurrentPulse.
          </div>

          <section
            className="article-rich-content licensed-republished-article"
            dangerouslySetInnerHTML={{ __html: article.content || "" }}
          />

          {source?.source_url ? (
            <section className="news-source-box">
              <h2>Original source</h2>
              <ul>
                <li>
                  <a
                    href={source.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <strong>The Conversation</strong>
                    {source.source_title ? ` — ${source.source_title}` : ""}
                  </a>
                </li>
              </ul>
            </section>
          ) : null}

          <div className="news-article-footer">
            <Link href="/news">← Back to latest news</Link>
          </div>
        </article>
      </main>
    </>
  );
}
