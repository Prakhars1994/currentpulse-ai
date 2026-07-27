import Link from "next/link";
import { supabase } from "@/lib/supabase";

function createCategorySlug(value = "") {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatCategoryName(value = "") {
  return value
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default async function CategoryPage({ params }) {
  const { category } = await params;

  const decodedCategory = decodeURIComponent(category);
  const formattedCategory = formatCategoryName(decodedCategory);

  const { data: allArticles, error } = await supabase
    .from("articles")
    .select("*")
    .eq("status", "published")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Category articles error:", error);
  }

  const articles =
    allArticles?.filter((article) => {
      const articleCategorySlug = createCategorySlug(article.category);

      return articleCategorySlug === decodedCategory.toLowerCase();
    }) || [];

  return (
    <main className="mx-auto max-w-6xl p-8">
      <h1 className="text-4xl font-bold">
        {formattedCategory} Current Affairs
      </h1>

      <p className="mt-3 text-gray-600">
        UPSC current affairs analysis and latest published articles for{" "}
        {formattedCategory}.
      </p>

      {articles.length > 0 ? (
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {articles.map((article) => (
            <article
              key={article.id}
              className="rounded-xl border bg-white p-6 shadow-sm"
            >
              <div className="flex flex-wrap gap-2">
                {article.paper && (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
                    {article.paper}
                  </span>
                )}

                {article.category && (
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
                    {article.category}
                  </span>
                )}
              </div>

              <h2 className="mt-4 text-2xl font-bold">
                {article.title}
              </h2>

              {article.why_news && (
                <p className="mt-3 line-clamp-3 text-gray-600">
                  {article.why_news}
                </p>
              )}

              <Link
                href={`/current-affairs/${article.slug}`}
                className="mt-5 inline-block rounded-lg bg-black px-5 py-2 text-white transition hover:bg-gray-800"
              >
                Read More
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-10 rounded-xl border bg-white p-8 text-center">
          <h2 className="text-xl font-bold">
            No published articles found
          </h2>

          <p className="mt-2 text-gray-500">
            Articles in this category will appear here after they are
            published.
          </p>

          <Link
            href="/current-affairs"
            className="mt-5 inline-block rounded-lg bg-black px-5 py-2 text-white"
          >
            View All Current Affairs
          </Link>
        </div>
      )}
    </main>
  );
}