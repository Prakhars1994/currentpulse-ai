export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { loadArticleStreams } from "@/lib/articleStreams";
import { createCategorySlug } from "@/lib/categoryRouting";
import { resolveDisplayImage } from "@/lib/news/categoryImage";
import { SITE_URL } from "@/lib/siteUrl";

export const metadata = {
  title: "Important News for UPSC — India & World Analysis",
  description:
    "Read AI-selected India-centric and globally important news, evaluated for UPSC relevance and converted into concise Prelims and Mains analysis.",
  alternates: { canonical: `${SITE_URL}/news` },
  openGraph: {
    title: "Important News Analysis for UPSC | CurrentPulse AI",
    description:
      "AI-selected national and global developments with clear UPSC relevance, syllabus linkage and exam-focused analysis.",
    url: `${SITE_URL}/news`,
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

function formatDate(value) {
  if (!value) return "Date unavailable";

  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function NewsPage() {
  const { news: articles, error } = await loadArticleStreams(500);

  if (error) {
    console.error("News stream error:", error);
  }

  return (
    <main className="min-h-screen bg-slate-950 py-10 text-white sm:py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-[2rem] border border-amber-400/20 bg-[radial-gradient(circle_at_90%_0%,rgba(251,191,36,.14),transparent_35%),linear-gradient(135deg,#0f172a,#111827)] px-6 py-10 shadow-2xl shadow-slate-950/30 sm:px-10 sm:py-12">
          <p className="font-black uppercase tracking-[.22em] text-amber-400">
            CurrentPulse AI news desk
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">
            Important News Analysis
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-300">
            India-centric and globally systemic developments collected by the
            news engine, screened for UPSC relevance and converted into useful
            Prelims facts and Mains dimensions.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              href="/current-affairs"
              className="rounded-xl bg-amber-400 px-5 py-3 font-black text-slate-950 transition hover:bg-amber-300"
            >
              Coaching Current Affairs
            </Link>
            <Link
              href="/categories"
              className="rounded-xl border border-slate-700 bg-slate-900/70 px-5 py-3 font-bold text-slate-100 transition hover:border-amber-400"
            >
              Browse by syllabus
            </Link>
            <span className="ml-auto rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-300">
              {articles.length} published analyses
            </span>
          </div>
        </div>

        {articles.length > 0 ? (
          <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {articles.map((article) => {
              const categorySlug = createCategorySlug(article.category);
              const description =
                stripHtml(article.why_news) ||
                "Read the complete AI-selected UPSC news analysis.";

              return (
                <article
                  key={article.id}
                  className="group overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/80 shadow-xl shadow-slate-950/20 transition hover:-translate-y-1 hover:border-amber-400/50 hover:shadow-2xl hover:shadow-amber-950/20"
                >
                  <Link
                    href={`/current-affairs/${article.slug}`}
                    className="block overflow-hidden"
                  >
                    <img
                      src={resolveDisplayImage(article)}
                      alt={article.title || "UPSC news analysis"}
                      loading="lazy"
                      decoding="async"
                      className="h-48 w-full object-cover transition duration-700 group-hover:scale-[1.04] sm:h-52"
                    />
                  </Link>

                  <div className="p-6">
                    <div className="flex flex-wrap items-center gap-2">
                      {article.category && (
                        <Link
                          href={`/category/${categorySlug}`}
                          className="rounded-full bg-amber-400/10 px-3 py-1.5 text-xs font-bold text-amber-300 ring-1 ring-amber-400/20 transition hover:bg-amber-400/20"
                        >
                          {article.category}
                        </Link>
                      )}
                      <span className="rounded-full bg-blue-400/10 px-3 py-1.5 text-xs font-bold text-blue-300 ring-1 ring-blue-400/15">
                        {article.paper || "General Studies"}
                      </span>
                    </div>

                    <Link href={`/current-affairs/${article.slug}`}>
                      <h2 className="mt-4 text-xl font-black leading-snug tracking-tight text-white transition group-hover:text-amber-300 sm:text-2xl">
                        {article.title || "Untitled news analysis"}
                      </h2>
                    </Link>

                    <p className="mt-3 line-clamp-3 leading-7 text-slate-400">
                      {description}
                    </p>

                    <div className="mt-6 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold text-amber-300">
                          CurrentPulse News Desk
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {formatDate(article.created_at)}
                        </p>
                      </div>
                      <Link
                        href={`/current-affairs/${article.slug}`}
                        className="font-bold text-amber-400 transition hover:text-amber-300"
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
              No AI news analysis found
            </h2>
            <p className="mt-3 text-slate-400">
              New articles will appear after the news automation completes.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
