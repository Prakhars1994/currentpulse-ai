export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { CATEGORY_ROUTES, articleMatchesCategory } from "@/lib/categoryRouting";

export default async function CategoriesPage() {
  const { data, error } = await supabase
    .from("articles")
    .select("category,title,why_news,prelims,mains")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) console.error("Category count fetch failed:", error.message);
  const articles = data || [];

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-14 text-white">
      <div className="mx-auto max-w-7xl">
        <p className="font-bold uppercase tracking-[0.24em] text-cyan-400">
          Structured revision
        </p>
        <h1 className="mt-3 text-4xl font-black sm:text-5xl">Explore categories</h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-400">
          Browse published current affairs using normalized UPSC categories. Legacy
          category names are included automatically.
        </p>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {CATEGORY_ROUTES.map((route) => {
            const count = articles.filter((article) =>
              articleMatchesCategory(article, route)
            ).length;

            return (
              <Link
                key={route.slug}
                href={`/category/${route.slug}`}
                className="group rounded-2xl border border-slate-800 bg-slate-900 p-6 transition hover:-translate-y-1 hover:border-cyan-500"
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="text-4xl">{route.icon}</span>
                  <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-bold text-cyan-300">
                    {count} articles
                  </span>
                </div>
                <h2 className="mt-5 text-xl font-bold group-hover:text-cyan-300">
                  {route.name}
                </h2>
                <p className="mt-2 text-sm text-slate-500">Open category →</p>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
