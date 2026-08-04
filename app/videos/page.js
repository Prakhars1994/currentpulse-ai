export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { ExternalLink, PlayCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { resolveDisplayImage } from "@/lib/news/categoryImage";

export const metadata = {
  title: "Current Affairs Video Discovery",
  description: "Find UPSC video explainers for the latest published current-affairs topics.",
  alternates: { canonical: "/videos" },
};

export default async function VideosPage() {
  const { data, error } = await supabase
    .from("articles")
    .select("id,title,slug,category,paper,image,image_url,image_source_url,created_at")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(24);

  if (error) console.error("Video discovery fetch failed:", error.message);
  const articles = data || [];

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-14 text-white">
      <div className="mx-auto max-w-7xl">
        <p className="font-bold uppercase tracking-[0.24em] text-cyan-400">Topic-based learning</p>
        <h1 className="mt-3 text-4xl font-black sm:text-5xl">Current-affairs videos</h1>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-400">
          Start with the written CurrentPulse analysis, then discover recent UPSC
          video explanations for the same topic. Video searches open on YouTube.
        </p>

        {articles.length ? (
          <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {articles.map((article) => {
              const videoSearch = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${article.title} UPSC current affairs analysis`)}`;
              return (
                <article key={article.id} className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
                  <div className="relative">
                    <img
                      src={resolveDisplayImage(article)}
                      alt={`Video resources for ${article.title}`}
                      loading="lazy"
                      decoding="async"
                      className="h-44 w-full object-cover opacity-80"
                    />
                    <PlayCircle className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 text-white drop-shadow-xl" />
                  </div>
                  <div className="p-6">
                    <div className="flex flex-wrap gap-2 text-xs font-bold text-cyan-300">
                      <span>{article.category || "Current Affairs"}</span>
                      <span>•</span>
                      <span>{article.paper || "General Studies"}</span>
                    </div>
                    <h2 className="mt-3 text-xl font-bold leading-7">{article.title}</h2>
                    <div className="mt-6 flex flex-wrap gap-3">
                      <a href={videoSearch} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-bold text-slate-950">
                        Find videos <ExternalLink size={15} />
                      </a>
                      <Link href={`/current-affairs/${article.slug}`} className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold">
                        Read article
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-10 rounded-2xl border border-dashed border-slate-800 p-10 text-center text-slate-400">
            Video topics will appear after current-affairs articles are published.
          </div>
        )}
      </div>
    </main>
  );
}
