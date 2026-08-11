export const revalidate = 60;

import Link from "next/link";
import { loadNewsArticles } from "@/lib/articleStreams";
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
  return String(content || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/(^|\s)[#>*_~-]+(?=\S)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });
}

function pageHref(page) {
  return page <= 1 ? "/news" : `/news?page=${page}`;
}

export default async function NewsPage({ searchParams }) {
  const params = await searchParams;
  const requestedPage = Math.max(1, Number(params?.page) || 1);
  const pageSize = 48;
  const offset = (requestedPage - 1) * pageSize;
  const { articles, total, hasMore, error } = await loadNewsArticles({ limit: pageSize, offset });
  if (error) console.error("News stream error:", error);

  const totalPages = Number.isFinite(total)
    ? Math.max(1, Math.ceil(total / pageSize))
    : null;
  const currentPage = requestedPage;

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
          <strong>{total ?? "Full"}</strong> news archive
          <span>•</span>
          <span>Page {currentPage}{totalPages ? ` of ${totalPages}` : ""}</span>
          <span>•</span>
          <span>Older stories stay available after quality filtering and deduplication</span>
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
          <div className="newsroom-empty"><h2>No stories on this page</h2><p>Try the previous archive page.</p></div>
        )}

        {(currentPage > 1 || hasMore) && (
          <nav className="mt-10 flex flex-wrap items-center justify-center gap-3" aria-label="News archive pagination">
            {currentPage > 1 ? (
              <Link href={pageHref(currentPage - 1)} className="newsroom-secondary-action">← Newer stories</Link>
            ) : <span />}
            <span className="text-sm font-bold text-stone-600">
              Page {currentPage}{totalPages ? ` / ${totalPages}` : ""}
            </span>
            {hasMore ? (
              <Link href={pageHref(currentPage + 1)} className="newsroom-primary-action">Older stories →</Link>
            ) : <span />}
          </nav>
        )}
      </div>
    </main>
  );
}
