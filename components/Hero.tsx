import Link from "next/link";
import { supabase } from "@/lib/supabase";

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

export default async function Hero() {
  const [
    { data: featured, error: featuredError },
    { count: articleCount, error: articleCountError },
    { data: categoryRows, error: categoryError },
    { data: viewRows, error: viewsError },
  ] = await Promise.all([
    supabase
      .from("articles")
      .select(
        "id, title, slug, paper, why_news, image_url, created_at, status"
      )
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase
      .from("articles")
      .select("id", { count: "exact", head: true })
      .eq("status", "published"),

    supabase
      .from("articles")
      .select("category")
      .eq("status", "published"),

    supabase
      .from("articles")
      .select("views")
      .eq("status", "published"),
  ]);

  if (featuredError) {
    console.error("Featured article fetch error:", featuredError);
  }

  if (articleCountError) {
    console.error("Article count fetch error:", articleCountError);
  }

  if (categoryError) {
    console.error("Category count fetch error:", categoryError);
  }

  if (viewsError) {
    console.error("Views fetch error:", viewsError);
  }

  const categoryCount = new Set(
    (categoryRows || [])
      .map((row) => row.category)
      .filter(Boolean)
  ).size;

  const totalViews = (viewRows || []).reduce(
    (sum, row) => sum + Number(row.views || 0),
    0
  );

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
      {/* Background Blur */}
      <div className="absolute inset-0" aria-hidden="true">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-blue-500/20 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 py-24">
        <div className="grid items-center gap-16 lg:grid-cols-2">
          {/* Left Side */}
          <div>
            <span className="inline-flex items-center rounded-full border border-cyan-500/40 bg-cyan-500/10 px-5 py-2 text-sm font-semibold text-cyan-300">
              🚀 AI-Powered UPSC Preparation
            </span>

            <h1 className="mt-8 text-5xl font-extrabold leading-tight text-white md:text-7xl">
              Master
              <span className="block text-cyan-400">
                Current Affairs
              </span>
              for UPSC & PCS
            </h1>

            <p className="mt-8 max-w-2xl text-lg leading-8 text-gray-300">
              Daily current affairs, editorial analysis, prelims facts, mains
              answer writing, PYQs, AI-powered explanations, quizzes and
              downloadable PDFs — all in one platform.
            </p>

            <div className="mt-10 flex flex-wrap gap-5">
              <Link
                href="/current-affairs"
                className="rounded-xl bg-cyan-500 px-8 py-4 font-bold text-black transition hover:bg-cyan-400"
              >
                Read Today&apos;s Current Affairs
              </Link>

              <Link
                href="/ai"
                className="rounded-xl border border-white/20 px-8 py-4 font-bold text-white transition hover:bg-white/10"
              >
                🤖 Ask CurrentPulse AI
              </Link>
            </div>

            {/* Dynamic Statistics */}
            <div className="mt-14 grid grid-cols-3 gap-4 sm:gap-6">
              <div>
                <p className="text-3xl font-bold text-cyan-400 sm:text-4xl">
                  {(articleCount || 0).toLocaleString("en-IN")}
                </p>

                <p className="mt-2 text-sm text-gray-400 sm:text-base">
                  Articles
                </p>
              </div>

              <div>
                <p className="text-3xl font-bold text-cyan-400 sm:text-4xl">
                  {categoryCount.toLocaleString("en-IN")}
                </p>

                <p className="mt-2 text-sm text-gray-400 sm:text-base">
                  Categories
                </p>
              </div>

              <div>
                <p className="text-3xl font-bold text-cyan-400 sm:text-4xl">
                  {totalViews.toLocaleString("en-IN")}
                </p>

                <p className="mt-2 text-sm text-gray-400 sm:text-base">
                  Total Views
                </p>
              </div>
            </div>
          </div>

          {/* Right Side */}
          <div>
            {featured ? (
              <article className="overflow-hidden rounded-3xl border border-slate-700 bg-slate-900 shadow-2xl">
                <Link
                  href={`/current-affairs/${featured.slug}`}
                  className="block"
                >
                  <img
                    src={
                      featured.image_url ||
                      "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200"
                    }
                    alt={
                      featured.title ||
                      "Featured current affairs article"
                    }
                    className="h-60 w-full object-cover"
                  />
                </Link>

                <div className="p-8">
                  <span className="rounded-full bg-cyan-500 px-3 py-1 text-sm font-semibold text-black">
                    Featured Today
                  </span>

                  <Link href={`/current-affairs/${featured.slug}`}>
                    <h2 className="mt-6 text-3xl font-bold text-white transition hover:text-cyan-400">
                      {featured.title}
                    </h2>
                  </Link>

                  <p className="mt-5 line-clamp-4 leading-8 text-gray-300">
                    {stripHtml(featured.why_news) ||
                      "Read the complete current affairs analysis."}
                  </p>

                  <div className="mt-8 flex items-center justify-between gap-4">
                    <span className="rounded-full bg-blue-600 px-4 py-2 text-white">
                      {featured.paper || "General Studies"}
                    </span>

                    <Link
                      href={`/current-affairs/${featured.slug}`}
                      className="font-bold text-cyan-400 transition hover:text-cyan-300"
                    >
                      Read Article →
                    </Link>
                  </div>
                </div>
              </article>
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-700 p-10 text-center text-gray-400">
                Publish your first article to display it here.
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}