export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import {
  currentAffairsSourceLabel,
  loadCurrentAffairsArticles,
} from "@/lib/articleStreams";
import { createCategorySlug } from "@/lib/categoryRouting";
import { resolveDisplayImage } from "@/lib/news/categoryImage";
import { SITE_URL } from "@/lib/siteUrl";

export const metadata = {
  title: "Daily UPSC Current Affairs — Prelims & Mains Analysis",
  description:
    "Read daily UPSC current affairs with exact syllabus linkage, India relevance, static foundation, Prelims facts, data, examples and Mains answer frameworks.",
  alternates: { canonical: `${SITE_URL}/current-affairs` },
  openGraph: {
    title: "Daily UPSC Current Affairs | CurrentPulse AI",
    description:
      "Selection-oriented current affairs connected to UPSC Prelims, Mains and static subjects.",
    url: `${SITE_URL}/current-affairs`,
    type: "website",
  },
};

function stripHtml(content = "") {
  return content
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function pageHref(page, todayOnly) {
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  if (todayOnly) params.set("view", "today");
  const query = params.toString();
  return query ? `/current-affairs?${query}` : "/current-affairs";
}

export default async function CurrentAffairsPage({ searchParams }) {
  const params = await searchParams;
  const requestedPage = Math.max(1, Number(params?.page) || 1);
  const todayOnly = params?.view === "today";
  const pageSize = 48;
  const offset = (requestedPage - 1) * pageSize;
  const { articles, total, hasMore, date, error } = await loadCurrentAffairsArticles({
    limit: pageSize, offset, todayOnly,
  });
  const totalPages = Number.isFinite(total) ? Math.max(1, Math.ceil(total / pageSize)) : null;

  if (error) {
    console.error("Current affairs error:", error);
  }

  return (
    <main className="min-h-screen bg-slate-950 py-10 text-white sm:py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-[2rem] border border-cyan-400/15 bg-[radial-gradient(circle_at_90%_0%,rgba(6,182,212,.16),transparent_35%),linear-gradient(135deg,#0f172a,#08111f)] px-6 py-10 shadow-2xl shadow-slate-950/30 sm:px-10 sm:py-12">
          <p className="font-black uppercase tracking-[.22em] text-cyan-400">Coaching + important news synthesis</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
            UPSC Current Affairs
          </h1>

          <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-300">
            Important UPSC-relevant developments from trusted coaching coverage and
            the CurrentPulse news pipeline, deduplicated, merged and rebuilt as
            selection-oriented Prelims and Mains briefs.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link href="/categories" className="rounded-xl bg-cyan-400 px-5 py-3 font-black text-slate-950 transition hover:bg-cyan-300">Browse by syllabus</Link>
            <Link href="/quiz" className="rounded-xl border border-slate-700 bg-slate-900/70 px-5 py-3 font-bold text-slate-100 transition hover:border-cyan-400">Attempt today&apos;s quiz</Link>
            <Link href="/current-affairs" className={`rounded-xl px-4 py-2 text-sm font-black ${!todayOnly ? "bg-cyan-400 text-slate-950" : "border border-slate-700 text-slate-200"}`}>All briefs</Link>
            <Link href="/current-affairs?view=today" className={`rounded-xl px-4 py-2 text-sm font-black ${todayOnly ? "bg-cyan-400 text-slate-950" : "border border-slate-700 text-slate-200"}`}>Today · {date}</Link>
            <span className="ml-auto rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-300">{Number.isFinite(total) ? `${total} ${todayOnly ? "today" : "curated briefs"}` : "Curated CA archive"} · Page {requestedPage}{totalPages ? `/${totalPages}` : ""}</span>
          </div>
        </div>

        {articles && articles.length > 0 ? (
          <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {articles.map((article) => {
              const categorySlug = createCategorySlug(article.category);
              const image = resolveDisplayImage(article);

              const description = article.why_news
                ? stripHtml(article.why_news)
                : "Read the complete UPSC current affairs analysis.";

              return (
                <article
                  key={article.id}
                  className="group overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/80 shadow-xl shadow-slate-950/20 transition hover:-translate-y-1 hover:border-cyan-400/50 hover:shadow-2xl hover:shadow-cyan-950/20"
                >
                  {image ? (
                    <Link href={`/current-affairs/${article.slug}`} className="block overflow-hidden">
                      <img src={image} alt={article.title || "Current affairs article"} loading="lazy" decoding="async" className="h-48 w-full object-cover transition duration-700 group-hover:scale-[1.04] sm:h-52" />
                    </Link>
                  ) : (
                    <div className="ca-card-noimage" aria-hidden="true"><span>{article.category || "Current Affairs"}</span></div>
                  )}

                  <div className="p-6">
                    <div className="flex flex-wrap items-center gap-2">
                      {article.category && (
                        <Link
                          href={`/category/${categorySlug}`}
                          className="rounded-full bg-cyan-400/10 px-3 py-1.5 text-xs font-bold text-cyan-300 ring-1 ring-cyan-400/20 transition hover:bg-cyan-400/20"
                        >
                          {article.category}
                        </Link>
                      )}

                      <span className="rounded-full bg-blue-400/10 px-3 py-1.5 text-xs font-bold text-blue-300 ring-1 ring-blue-400/15">
                        {article.paper || "General Studies"}
                      </span>
                    </div>

                    <Link href={`/current-affairs/${article.slug}`}>
                      <h2 className="mt-4 text-xl font-black leading-snug tracking-tight text-white transition group-hover:text-cyan-300 sm:text-2xl">{article.title || "Untitled article"}</h2>
                    </Link>

                    <p className="mt-3 line-clamp-3 leading-7 text-slate-400">
                      {description}
                    </p>

                    <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="max-w-48 truncate text-xs font-bold text-cyan-300">
                          {currentAffairsSourceLabel(article)}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {article.created_at
                            ? new Date(article.created_at).toLocaleDateString(
                                "en-IN",
                                {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                }
                              )
                            : "Date unavailable"}
                        </p>
                      </div>

                      <Link
                        href={`/current-affairs/${article.slug}`}
                        className="font-bold text-cyan-400 transition hover:text-cyan-300"
                      >
                        Read More →
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-10 rounded-3xl border border-slate-800 bg-slate-900 p-10 text-center shadow-xl">
            <h2 className="text-2xl font-bold text-white">
              No current affairs articles found
            </h2>

            <p className="mt-3 text-slate-400">
              Published articles will appear here.
            </p>
          </div>
        )}

        {(requestedPage > 1 || hasMore) && (
          <nav className="mt-10 flex flex-wrap items-center justify-center gap-3" aria-label="Current affairs pagination">
            {requestedPage > 1 && <Link href={pageHref(requestedPage - 1, todayOnly)} className="rounded-xl border border-slate-700 px-5 py-3 font-black text-slate-200">← Newer briefs</Link>}
            <span className="text-sm font-bold text-slate-400">Page {requestedPage}{totalPages ? ` of ${totalPages}` : ""}</span>
            {hasMore && <Link href={pageHref(requestedPage + 1, todayOnly)} className="rounded-xl bg-cyan-400 px-5 py-3 font-black text-slate-950">Older briefs →</Link>}
          </nav>
        )}
      </div>
    </main>
  );
}
