import Link from "next/link";
import { rankNewsByPriority } from "@/lib/news/headlinePriority";

type BreakingArticle = {
  slug: string;
  title?: string | null;
  category?: string | null;
  why_news?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};
type StreamError = { message?: string } | null;

export default function BreakingNews({ newsStream = [], error = null }: { newsStream?: BreakingArticle[]; error?: StreamError }) {
  const news = rankNewsByPriority(newsStream).slice(0, 5);

  if (error) {
    console.error("Top Stories Error:", error.message);
    return null;
  }
  if (!news.length) return null;

  return (
    <section className="border-y border-red-900/40 bg-red-950">
      <div className="mx-auto flex max-w-7xl items-center overflow-hidden">
        <div className="flex shrink-0 items-center bg-red-600 px-4 py-3 text-sm font-bold uppercase tracking-wide text-white sm:px-5">
          <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-white" />
          Top Stories
        </div>
        <div className="flex-1 overflow-hidden">
          <div className="flex min-w-max items-center whitespace-nowrap">
            {news.map((article, index) => (
              <div key={article.slug} className="flex items-center">
                <Link href={`/news/${article.slug}`} className="px-6 py-3 text-sm font-medium text-white transition hover:text-cyan-300 sm:px-8">
                  {article.title}
                </Link>
                {index < news.length - 1 && <span className="text-red-400" aria-hidden="true">•</span>}
              </div>
            ))}
          </div>
        </div>
        <Link href="/news" className="hidden shrink-0 border-l border-red-800/60 px-5 py-3 text-sm font-semibold text-red-200 transition hover:bg-red-900 hover:text-white lg:block">
          View All →
        </Link>
      </div>
    </section>
  );
}
