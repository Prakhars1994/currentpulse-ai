export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { supabase } from "@/lib/supabase";

function createCategorySlug(category = "") {
  return category
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function stripHtml(content = "") {
  return content
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export default async function CurrentAffairsPage() {
  const { data: articles, error } = await supabase
    .from("articles")
    .select(
      "id,title,slug,category,paper,why_news,image_url,created_at,status"
    )
    .eq("status", "published")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Current affairs error:", error);
  }

  return (
    <main className="min-h-screen bg-slate-100 py-12">
      <div className="mx-auto max-w-6xl px-6">
        <div>
          <h1 className="text-4xl font-bold text-slate-900">
            Daily Current Affairs
          </h1>

          <p className="mt-2 text-gray-600">
            UPSC, PCS, SSC and Banking exam-focused current affairs.
          </p>
        </div>

        {articles && articles.length > 0 ? (
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {articles.map((article) => {
              const categorySlug = createCategorySlug(article.category);

              const description = article.why_news
                ? stripHtml(article.why_news)
                : "Read the complete UPSC current affairs analysis.";

              return (
                <article
                  key={article.id}
                  className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
                >
                  <img
                    src={
                      article.image_url ||
                      "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=900"
                    }
                    alt={article.title || "Current affairs article"}
                    className="h-52 w-full object-cover"
                  />

                  <div className="p-6">
                    <div className="flex flex-wrap items-center gap-2">
                      {article.category && (
                        <Link
                          href={`/category/${categorySlug}`}
                          className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold text-cyan-800 transition hover:bg-cyan-200"
                        >
                          {article.category}
                        </Link>
                      )}

                      <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                        {article.paper || "General Studies"}
                      </span>
                    </div>

                    <h2 className="mt-4 text-2xl font-bold text-slate-900">
                      {article.title || "Untitled article"}
                    </h2>

                    <p className="mt-3 line-clamp-3 text-gray-600">
                      {description}
                    </p>

                    <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                      <span className="text-sm text-gray-500">
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
                      </span>

                      <Link
                        href={`/current-affairs/${article.slug}`}
                        className="font-semibold text-cyan-700 transition hover:text-cyan-900"
                      >
                        Read More â†’
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-10 rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900">
              No current affairs articles found
            </h2>

            <p className="mt-3 text-gray-600">
              Published articles will appear here.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
