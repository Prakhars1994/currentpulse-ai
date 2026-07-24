import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default async function SearchPage({ searchParams }: any) {
  const params = await searchParams;
  const query = params?.q?.trim() || "";

  let articles: any[] = [];

  if (query) {
    const safeQuery = query.replace(/[%_,]/g, "");

    const { data, error } = await supabase
      .from("articles")
      .select(
        "id,title,slug,category,paper,why_news,image_url,created_at,status"
      )
      .or(
        `title.ilike.%${safeQuery}%,category.ilike.%${safeQuery}%,paper.ilike.%${safeQuery}%`
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Search Error:", error);
    }

    articles = data || [];
  }

  return (
    <main className="min-h-screen bg-slate-100 py-12">
      <div className="mx-auto max-w-6xl px-6">
        <h1 className="text-4xl font-bold text-slate-900">
          Search Results
        </h1>

        <p className="mt-3 text-gray-600">
          {query
            ? `Showing results for "${query}"`
            : "Enter a search term from the navigation bar."}
        </p>

        <div className="mt-10 space-y-6">
          {articles.length > 0 ? (
            articles.map((article) => (
              <Link
                key={article.id}
                href={`/current-affairs/${article.slug}`}
                className="block rounded-2xl bg-white p-6 shadow transition hover:shadow-xl"
              >
                <div className="flex flex-col gap-6 md:flex-row">
                  <img
                    src={
                      article.image_url ||
                      "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800"
                    }
                    alt={article.title}
                    className="h-40 w-full rounded-xl object-cover md:h-32 md:w-52"
                  />

                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="rounded-full bg-cyan-600 px-3 py-1 text-xs font-semibold text-white">
                        {article.category || "Current Affairs"}
                      </span>

                      <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                        {article.paper || "General Studies"}
                      </span>
                    </div>

                    <h2 className="mt-4 text-2xl font-bold text-slate-900">
                      {article.title}
                    </h2>

                    <p className="mt-3 line-clamp-2 text-gray-600">
                      {article.why_news ||
                        "Read the complete UPSC current affairs analysis."}
                    </p>

                    <div className="mt-5 text-sm text-gray-500">
                      {article.created_at &&
                        new Date(article.created_at).toLocaleDateString(
                          "en-IN",
                          {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          }
                        )}
                    </div>
                  </div>
                </div>
              </Link>
            ))
          ) : query ? (
            <div className="rounded-2xl bg-white p-10 text-center shadow">
              <h2 className="text-2xl font-bold text-slate-900">
                No articles found
              </h2>

              <p className="mt-3 text-gray-600">
                Try searching with another keyword.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl bg-white p-10 text-center shadow">
              <h2 className="text-2xl font-bold text-slate-900">
                Start Searching
              </h2>

              <p className="mt-3 text-gray-600">
                Use the search bar in the navigation menu to search articles by
                title, category, or GS paper.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}