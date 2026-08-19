export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { loadNewsArticles } from "@/lib/articleStreams";
import { createCategorySlug } from "@/lib/categoryRouting";
import { resolveDisplayImage } from "@/lib/news/categoryImage";
import { rankNewsByPriority } from "@/lib/news/headlinePriority";
import { SITE_URL } from "@/lib/siteUrl";

export async function generateMetadata({ searchParams }) {
  const params = await searchParams;
  const page = Math.max(1, Number(params?.page) || 1);
  const canonical = page <= 1 ? `${SITE_URL}/news` : `${SITE_URL}/news/page/${page}`;
  const title = page <= 1 ? "Latest India & World News" : `Latest India & World News - Page ${page}`;
  const description = "Read concise, source-backed India and world news with key facts, context and why each development matters.";

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: "website" },
  };
}

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
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });
}

function pageHref(page) {
  return page <= 1 ? "/news" : `/news/page/${page}`;
}

export default async function NewsPage({ searchParams }) {
  const params = await searchParams;
  const requestedPage = Math.max(1, Number(params?.page) || 1);
  const pageSize = 24;
  const offset = (requestedPage - 1) * pageSize;
  const { articles, total, hasMore, error } = await loadNewsArticles({ limit: pageSize, offset });
  if (error) console.error("News stream error:", error);

  const totalPages = Number.isFinite(total) ? Math.max(1, Math.ceil(total / pageSize)) : null;
  const currentPage = requestedPage;
  const topStories = currentPage === 1 ? rankNewsByPriority(articles).slice(0, 5) : [];

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
          <strong>{total ?? (hasMore ? "Growing" : articles.length)}</strong> news archive
          <span>•</span>
          <span>Page {currentPage}{totalPages ? ` of ${totalPages}` : ""}</span>
          <span>•</span>
          <span>All retained stories stay in chronological archive; Top Stories are impact-ranked separately.</span>
        </div>

        {topStories.length > 0 && (
          <section className="mb-9 rounded-3xl border border-red-200 bg-white p-5 shadow-sm sm:p-7" aria-label="Top stories">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[.2em] text-red-700">Top Stories</p>
                <h2 className="mt-1 text-2xl font-black text-stone-950">High-impact developments first</h2>
              </div>
              <span className="text-xs font-semibold text-stone-500">Archive remains complete below</span>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {topStories.map((article, index) => (
                <Link key={article.id} href={`/news/${article.slug}`} className="rounded-2xl border border-stone-200 p-4 transition hover:border-red-300 hover:bg-red-50/60">
                  <p className="text-xs font-black uppercase tracking-wide text-red-700">#{index + 1} · {article.category || "News"}</p>
                  <h3 className="mt-2 font-black leading-6 text-stone-950">{article.title}</h3>
                </Link>
              ))}
            </div>
          </section>
        )}

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
                    <Link href={`/news/${article.slug}`}><h2>{article.title}</h2></Link>
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
            {currentPage > 1 ? <Link href={pageHref(currentPage - 1)} className="newsroom-secondary-action">← Newer stories</Link> : <span />}
            <span className="text-sm font-bold text-stone-600">Page {currentPage}{totalPages ? ` / ${totalPages}` : ""}</span>
            {hasMore ? <Link href={pageHref(currentPage + 1)} className="newsroom-primary-action">Older stories →</Link> : <span />}
          </nav>
        )}
      </div>
    </main>
  );
}
