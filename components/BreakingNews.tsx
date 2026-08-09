import Link from "next/link";
import { loadArticleStreams } from "@/lib/articleStreams";

export default async function BreakingNews() {
  const { news: newsStream, error } = await loadArticleStreams(120);
  const news = newsStream.slice(0, 5);

  if (error) {
    console.error("Breaking News Error:", error.message);
    return null;
  }

  if (!news || news.length === 0) {
    return null;
  }

  return (
    <section className="border-y border-red-900/40 bg-red-950">
      <div className="mx-auto flex max-w-7xl items-center overflow-hidden">
        {/* Breaking badge */}
        <div className="flex shrink-0 items-center bg-red-600 px-4 py-3 text-sm font-bold uppercase tracking-wide text-white sm:px-5">
          <span className="mr-2 inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-white" />
          Breaking
        </div>

        {/* News items */}
        <div className="flex-1 overflow-x-auto">
          <div className="flex min-w-max items-center whitespace-nowrap">
            {news.map((article, index) => (
              <div
                key={article.slug}
                className="flex items-center"
              >
                <Link
                  href={`/news/${article.slug}`}
                  className="px-6 py-3 text-sm font-medium text-white transition hover:text-cyan-300 sm:px-8"
                >
                  {article.title}
                </Link>

                {index < news.length - 1 && (
                  <span
                    className="text-red-400"
                    aria-hidden="true"
                  >
                    •
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Explore link */}
        <Link
          href="/news"
          className="hidden shrink-0 border-l border-red-800/60 px-5 py-3 text-sm font-semibold text-red-200 transition hover:bg-red-900 hover:text-white lg:block"
        >
          View All →
        </Link>
      </div>
    </section>
  );
}
