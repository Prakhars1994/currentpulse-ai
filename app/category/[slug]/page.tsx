export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  CATEGORY_ROUTES,
  articleMatchesCategory,
  resolveCategoryRoute,
} from "@/lib/categoryRouting";
import { resolveDisplayImage } from "@/lib/news/categoryImage";

type Props = {
  params: Promise<{ slug: string }>;
};

type Article = {
  id: number;
  title: string;
  slug: string;
  category: string | null;
  paper: string | null;
  why_news: string | null;
  prelims: string | null;
  mains: string | null;
  image: string | null;
  image_url: string | null;
  created_at: string | null;
};

function plainText(value = "") {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/[#*_`>~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  const route = resolveCategoryRoute(slug);
  if (!route) notFound();

  const { data, error } = await supabase
    .from("articles")
    .select(
      "id,title,slug,category,paper,why_news,prelims,mains,image,image_url,created_at"
    )
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(600);

  if (error) console.error("Category fetch failed:", error.message);

  const articles = ((data || []) as Article[]).filter((article) =>
    articleMatchesCategory(article, route)
  );

  const related = CATEGORY_ROUTES.filter((item) => item.slug !== route.slug).slice(
    0,
    5
  );

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="border-b border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950/40">
        <div className="mx-auto max-w-7xl px-6 py-14">
          <Link href="/categories" className="text-sm font-semibold text-cyan-400">
            ← All categories
          </Link>
          <div className="mt-5 flex items-start gap-4">
            <span className="text-5xl" aria-hidden="true">
              {route.icon}
            </span>
            <div>
              <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
                {route.name}
              </h1>
              <p className="mt-3 text-lg text-slate-300">
                {articles.length} published UPSC current-affairs
                {articles.length === 1 ? " article" : " articles"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-12">
        {articles.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {articles.map((article) => (
              <article
                key={article.id}
                className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-xl"
              >
                <img
                  src={resolveDisplayImage(article)}
                  alt=""
                  className="h-44 w-full object-cover"
                />
                <div className="p-6">
                  <div className="flex flex-wrap gap-2 text-xs font-bold">
                    <span className="rounded-full bg-cyan-500/15 px-3 py-1 text-cyan-300">
                      {article.category || route.name}
                    </span>
                    <span className="rounded-full bg-slate-800 px-3 py-1 text-slate-300">
                      {article.paper || "General Studies"}
                    </span>
                  </div>
                  <h2 className="mt-4 text-xl font-bold leading-snug">
                    {article.title}
                  </h2>
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-400">
                    {plainText(article.why_news || "Complete UPSC-focused analysis.")}
                  </p>
                  <div className="mt-6 flex items-center justify-between gap-3">
                    <span className="text-xs text-slate-500">
                      {article.created_at
                        ? new Date(article.created_at).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : ""}
                    </span>
                    <Link
                      href={`/current-affairs/${article.slug}`}
                      className="font-bold text-cyan-400 hover:text-cyan-300"
                    >
                      Read analysis →
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-10 text-center">
            <div className="text-5xl">{route.icon}</div>
            <h2 className="mt-5 text-2xl font-bold">No published articles yet</h2>
            <p className="mx-auto mt-3 max-w-xl text-slate-400">
              This category is active. Relevant articles will appear automatically
              when the publishing pipeline identifies an important event.
            </p>
            <Link
              href="/current-affairs"
              className="mt-7 inline-flex rounded-xl bg-cyan-500 px-6 py-3 font-bold text-slate-950"
            >
              Browse all current affairs
            </Link>
          </div>
        )}

        <div className="mt-14 border-t border-slate-800 pt-8">
          <h2 className="text-xl font-bold">Explore related categories</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            {related.map((item) => (
              <Link
                key={item.slug}
                href={`/category/${item.slug}`}
                className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:border-cyan-400 hover:text-cyan-300"
              >
                {item.icon} {item.shortName || item.name}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
