import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { resolveDisplayImage } from "@/lib/news/categoryImage";

export const revalidate = 0;

function stripHtml(value: string | null) {
  if (!value) return "";

  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function formatDate(date: string | null) {
  if (!date) return "";

  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatViews(views: number | null) {
  const totalViews = Number(views || 0);

  if (totalViews >= 1000000) {
    return `${(totalViews / 1000000).toFixed(1)}M`;
  }

  if (totalViews >= 1000) {
    return `${(totalViews / 1000).toFixed(1)}K`;
  }

  return totalViews.toString();
}

export default async function LatestNews() {
  const [latestResult, trendingResult] = await Promise.all([
    supabase
      .from("articles")
      .select(
        "id, title, slug, category, paper, why_news, image, image_url, image_source_url, created_at, views"
      )
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(6),

    supabase
      .from("articles")
      .select(
        "id, title, slug, category, paper, image, image_url, image_source_url, created_at, views"
      )
      .eq("status", "published")
      .order("views", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const news = latestResult.data;
  const newsError = latestResult.error;

  const trendingArticles = trendingResult.data;
  const trendingError = trendingResult.error;

  return (
    <>
      {/* Trending Articles */}
      <section className="bg-slate-900 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-12 flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="font-semibold uppercase tracking-widest text-orange-400">
                Most Read
              </p>

              <h2 className="mt-3 text-4xl font-bold text-white">
                🔥 Trending Articles
              </h2>

              <p className="mt-4 max-w-2xl text-gray-400">
                Explore the current affairs articles receiving the most
                attention from readers.
              </p>
            </div>

            <Link
              href="/current-affairs"
              className="w-fit rounded-xl border border-orange-500 px-5 py-3 font-semibold text-orange-400 transition hover:bg-orange-500 hover:text-black"
            >
              Explore All →
            </Link>
          </div>

          {trendingError && (
            <div className="rounded-2xl border border-red-500/40 bg-red-950/40 p-6 text-red-300">
              Unable to load trending articles: {trendingError.message}
            </div>
          )}

          {!trendingError &&
            trendingArticles &&
            trendingArticles.length > 0 && (
              <div className="grid gap-8 lg:grid-cols-5">
                {/* Main Trending Article */}
                <article className="overflow-hidden rounded-3xl border border-orange-500/40 bg-slate-950 lg:col-span-3">
                  <Link
                    href={`/current-affairs/${trendingArticles[0].slug}`}
                    className="block"
                  >
                    <div className="relative overflow-hidden">
                      <img
                        src={resolveDisplayImage(trendingArticles[0])}
                        alt={
                          trendingArticles[0].title ||
                          "Trending current affairs article"
                        }
                        className="h-72 w-full object-cover transition duration-500 hover:scale-105 md:h-96"
                        loading="lazy"
                      />

                      <div className="absolute left-5 top-5 rounded-full bg-orange-500 px-4 py-2 text-sm font-bold text-black">
                        #1 Trending
                      </div>
                    </div>

                    <div className="p-7 md:p-9">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="rounded-full bg-cyan-500 px-3 py-1 text-xs font-bold text-black">
                          {trendingArticles[0].category ||
                            "Current Affairs"}
                        </span>

                        <span className="text-sm text-gray-400">
                          {trendingArticles[0].paper ||
                            "General Studies"}
                        </span>

                        <span className="text-sm font-semibold text-orange-400">
                          👁️{" "}
                          {formatViews(
                            trendingArticles[0].views
                          )}{" "}
                          views
                        </span>
                      </div>

                      <h3 className="mt-5 text-3xl font-bold leading-tight text-white md:text-4xl">
                        {trendingArticles[0].title}
                      </h3>

                      <div className="mt-7 flex items-center justify-between gap-4">
                        <span className="text-sm text-gray-500">
                          {formatDate(
                            trendingArticles[0].created_at
                          )}
                        </span>

                        <span className="font-semibold text-orange-400">
                          Read Article →
                        </span>
                      </div>
                    </div>
                  </Link>
                </article>

                {/* Remaining Trending Articles */}
                <div className="space-y-4 lg:col-span-2">
                  {trendingArticles.slice(1).map((item, index) => (
                    <Link
                      key={item.id}
                      href={`/current-affairs/${item.slug}`}
                      className="group flex gap-4 rounded-2xl border border-slate-800 bg-slate-950 p-4 transition hover:border-orange-500 hover:shadow-xl"
                    >
                      <div className="relative h-24 w-32 shrink-0 overflow-hidden rounded-xl">
                        <img
                          src={resolveDisplayImage(item)}
                          alt={
                            item.title ||
                            "Trending current affairs article"
                          }
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                          loading="lazy"
                        />

                        <div className="absolute left-2 top-2 rounded-md bg-orange-500 px-2 py-1 text-xs font-black text-black">
                          #{index + 2}
                        </div>
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-cyan-400">
                          {item.category || "Current Affairs"}
                        </p>

                        <h3 className="mt-2 line-clamp-2 font-bold text-white transition group-hover:text-orange-400">
                          {item.title}
                        </h3>

                        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                          <span>
                            👁️ {formatViews(item.views)} views
                          </span>

                          <span>
                            {formatDate(item.created_at)}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

          {!trendingError &&
            (!trendingArticles ||
              trendingArticles.length === 0) && (
              <div className="rounded-2xl border border-slate-700 bg-slate-950 p-10 text-center">
                <h3 className="text-2xl font-bold text-white">
                  No Trending Articles Yet
                </h3>

                <p className="mt-4 text-gray-400">
                  Trending articles will appear once readers start
                  viewing your content.
                </p>
              </div>
            )}
        </div>
      </section>
      {/* Latest Current Affairs */}
      <section className="bg-slate-950 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-12 flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="font-semibold uppercase tracking-widest text-cyan-400">
                Latest Updates
              </p>

              <h2 className="mt-3 text-4xl font-bold text-white">
                Latest Current Affairs
              </h2>
            </div>

            <Link
              href="/current-affairs"
              className="w-fit rounded-xl border border-cyan-500 px-5 py-3 text-cyan-400 transition hover:bg-cyan-500 hover:text-black"
            >
              View All →
            </Link>
          </div>

          {newsError && (
            <div className="mb-8 rounded-2xl border border-red-500/40 bg-red-950/40 p-6 text-red-300">
              Unable to load articles: {newsError.message}
            </div>
          )}

          {!newsError && news && news.length > 0 && (
            <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
              {news.map((item) => (
                <article
                  key={item.id}
                  className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 transition duration-300 hover:-translate-y-2 hover:border-cyan-500 hover:shadow-2xl"
                >
                  <Link
                    href={`/current-affairs/${item.slug}`}
                    className="block overflow-hidden"
                  >
                    <img
                      src={resolveDisplayImage(item)}
                      alt={
                        item.title ||
                        "Current affairs article"
                      }
                      className="h-56 w-full object-cover transition duration-500 hover:scale-105"
                      loading="lazy"
                    />
                  </Link>

                  <div className="p-6">
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-full bg-cyan-500 px-3 py-1 text-xs font-bold text-black">
                        {item.category || "Current Affairs"}
                      </span>

                      <span className="text-sm text-gray-400">
                        {item.paper || "General Studies"}
                      </span>
                    </div>

                    <Link href={`/current-affairs/${item.slug}`}>
                      <h3 className="mt-5 text-2xl font-bold text-white transition hover:text-cyan-400">
                        {item.title}
                      </h3>
                    </Link>

                    <p className="mt-4 line-clamp-3 text-gray-400">
                      {stripHtml(item.why_news) ||
                        "Read the complete current affairs analysis."}
                    </p>

                    <div className="mt-5 flex items-center gap-2 text-sm text-purple-400">
                      <span>👁️</span>

                      <span>
                        {formatViews(item.views)} views
                      </span>
                    </div>

                    <div className="mt-7 flex items-center justify-between">
                      <span className="text-sm text-gray-500">
                        {formatDate(item.created_at)}
                      </span>

                      <Link
                        href={`/current-affairs/${item.slug}`}
                        className="font-semibold text-cyan-400 transition hover:text-cyan-300"
                      >
                        Read More →
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          {!newsError && (!news || news.length === 0) && (
            <div className="rounded-2xl border border-slate-700 bg-slate-900 p-12 text-center">
              <h3 className="text-2xl font-bold text-white">
                No Articles Available Yet
              </h3>

              <p className="mt-4 text-gray-400">
                Publish an article from the admin panel and it will appear here
                automatically.
              </p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
