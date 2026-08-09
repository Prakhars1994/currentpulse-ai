export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { loadArticleStreams } from "@/lib/articleStreams";
import { createCategorySlug } from "@/lib/categoryRouting";
import { resolveDisplayImage } from "@/lib/news/categoryImage";
import { SITE_URL } from "@/lib/siteUrl";

export const metadata = {
  title: "Latest India & World News | CurrentPulse AI",
  description: "Read concise, source-backed India and world news with key facts, context and why each development matters.",
  alternates: { canonical: `${SITE_URL}/news` },
  openGraph: {
    title: "Latest News | CurrentPulse AI",
    description: "Concise India and world news with context and key facts.",
    url: `${SITE_URL}/news`,
    type: "website",
  },
};

function stripHtml(content = "") {
  return String(content || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default async function NewsPage() {
  const { news: articles, error } = await loadArticleStreams(500);
  if (error) console.error("News stream error:", error);

  return (
    <main className="newsroom-page min-h-screen py-10 sm:py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <header className="newsroom-hero">
          <div>
            <p className="newsroom-kicker">CurrentPulse Newsroom</p>
            <h1>News, without the exam-template clutter.</h1>
            <p>Fast, neutral India and world coverage with a clear summary, essential context and verified key facts.</p>
          </div>
          <div className="newsroom-hero-actions">
            <Link href="/current-affairs" className="newsroom-primary-action">UPSC Current Affairs →</Link>
            <Link href="/categories" className="newsroom-secondary-action">Browse topics</Link>
          </div>
        </header>

        <div className="newsroom-meta-row">
          <strong>{articles.length}</strong> recent unique stories
          <span>•</span>
          <span>Duplicate events are collapsed automatically</span>
        </div>

        {articles.length ? (
          <section className="newsroom-grid" aria-label="Latest news">
            {articles.map((article) => {
              const image = resolveDisplayImage(article);
              const categorySlug = createCategorySlug(article.category);
              const description = stripHtml(article.why_news).slice(0, 220) || "Open the story for the latest verified details.";
              return (
                <article key={article.id} className="newsroom-card">
                  {image ? (
                    <Link href={`/news/${article.slug}`} className="newsroom-card-image-wrap">
                      <img src={image} alt={article.image_alt || article.title} loading="lazy" decoding="async" className="newsroom-card-image" />
                    </Link>
                  ) : (
                    <div className="newsroom-card-noimage" aria-hidden="true"><span>{article.category || "News"}</span></div>
                  )}
                  <div className="newsroom-card-body">
                    <div className="newsroom-card-meta">
                      <Link href={`/category/${categorySlug}`}>{article.category || "News"}</Link>
                      <time>{formatDate(article.created_at)}</time>
                    </div>
                    <Link href={`/news/${article.slug}`}>
                      <h2>{article.title}</h2>
                    </Link>
                    <p>{description}</p>
                    <Link href={`/news/${article.slug}`} className="newsroom-read-link">Read story →</Link>
                  </div>
                </article>
              );
            })}
          </section>
        ) : (
          <div className="newsroom-empty"><h2>No news available yet</h2><p>The newsroom will update after the next successful collection run.</p></div>
        )}
      </div>
    </main>
  );
}
