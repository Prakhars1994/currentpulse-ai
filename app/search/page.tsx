import Link from "next/link";
import { supabase } from "@/lib/supabase";

type SearchPageProps = {
  searchParams: Promise<{
    q?: string;
  }>;
};

type Article = {
  id: string | number;
  title: string | null;
  slug: string | null;
  category: string | null;
  paper: string | null;
  why_news: string | null;
  image_url: string | null;
  created_at: string | null;
  status: string | null;
};

function stripHtml(content: string) {
  return content
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export default async function SearchPage({
  searchParams,
}: SearchPageProps) {
  const params = await searchParams;
  const query = params?.q?.trim() || "";

  let articles: Article[] = [];
  let searchError = "";

  if (query) {
    const safeQuery = query
      .replace(/[%_,]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (safeQuery) {
      const { data, error } = await supabase
        .from("articles")
        .select(
          "id,title,slug,category,paper,why_news,image_url,created_at,status"
        )
        .eq("status", "published")
        .or(
          `title.ilike.%${safeQuery}%,category.ilike.%${safeQuery}%,paper.ilike.%${safeQuery}%`
        )
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Search Error:", error);
        searchError = "Unable to complete the search. Please try again.";
      } else {
        articles = (data || []) as Article[];
      }
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 py-12">
      <div className="mx-auto max-w-6xl px-6">
        <div className="rounded-2xl bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">
            Search Current Affairs
          </h1>

          <p className="mt-3 text-gray-600">
            Search articles by title, category or GS paper.
          </p>

          <form action="/search" method="GET" className="mt-6 flex gap-3">
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Search NISAR, Economy, GS-3..."
              className="min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
            />

            <button
              type="submit"
              className="rounded-xl bg-cyan-600 px-5 py-3 font-semibold text-white transition hover:bg-cyan-700"
            >
              Search
            </button>
          </form>
        </div>

        <div className="mt-8">
          {query && !searchError && (
            <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-gray-600">
                Showing results for{" "}
                <span className="font-semibold text-slate-900">
                  “{query}”
                </span>
              </p>

              <p className="text-sm font-medium text-gray-500">
                {articles.length}{" "}
                {articles.length === 1 ? "article" : "articles"} found
              </p>
            </div>
          )}

          {searchError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-10 text-center">
              <h2 className="text-2xl font-bold text-red-700">
                Search failed
              </h2>

              <p className="mt-3 text-red-600">{searchError}</p>
            </div>
          ) : articles.length > 0 ? (
            <div className="space-y-6">
              {articles.map((article) => {
                const description = article.why_news
                  ? stripHtml(article.why_news)
                  : "Read the complete UPSC current affairs analysis.";

                return (
                  <Link
                    key={article.id}
                    href={`/current-affairs/${article.slug}`}
                    className="group block overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl"
                  >
                    <div className="flex flex-col md:flex-row">
                      <img
                        src={
                          article.image_url ||
                          "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800"
                        }
                        alt={article.title || "Current affairs article"}
                        className="h-52 w-full object-cover md:h-auto md:w-64"
                      />

                      <div className="flex-1 p-6">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold text-cyan-800">
                            {article.category || "Current Affairs"}
                          </span>

                          <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                            {article.paper || "General Studies"}
                          </span>
                        </div>

                        <h2 className="mt-4 text-2xl font-bold text-slate-900 transition group-hover:text-cyan-700">
                          {article.title || "Untitled article"}
                        </h2>

                        <p className="mt-3 line-clamp-2 text-gray-600">
                          {description}
                        </p>

                        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                          <span className="text-sm text-gray-500">
                            {article.created_at
                              ? new Date(
                                  article.created_at
                                ).toLocaleDateString("en-IN", {
                                  day: "numeric",
                                  month: "long",
                                  year: "numeric",
                                })
                              : "Date unavailable"}
                          </span>

                          <span className="font-semibold text-cyan-700">
                            Read Article →
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : query ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
              <h2 className="text-2xl font-bold text-slate-900">
                No articles found
              </h2>

              <p className="mt-3 text-gray-600">
                Try another keyword such as Economy, Environment, NISAR or GS-3.
              </p>

              <Link
                href="/current-affairs"
                className="mt-6 inline-flex rounded-lg bg-cyan-600 px-5 py-3 font-semibold text-white transition hover:bg-cyan-700"
              >
                View All Current Affairs
              </Link>
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
              <h2 className="text-2xl font-bold text-slate-900">
                Start Searching
              </h2>

              <p className="mt-3 text-gray-600">
                Enter an article title, category or GS paper in the search box
                above.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}