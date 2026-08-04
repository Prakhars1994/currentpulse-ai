export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { notFound } from "next/navigation";
import ArticleContent from "@/components/ArticleContent";
import PrintActions from "@/components/PrintActions";
import { supabase } from "@/lib/supabase";
import { resolveDigestRange } from "@/lib/study/digestDates";

const VALID_PERIODS = new Set(["daily", "weekly", "monthly"]);

export default async function DigestPage({ params, searchParams }) {
  const { period } = await params;
  const query = await searchParams;
  if (!VALID_PERIODS.has(period)) notFound();

  const range = resolveDigestRange(period, query?.date);
  const { data, error } = await supabase
    .from("articles")
    .select("id,title,slug,category,paper,why_news,prelims,mains,question,created_at,article_sources!inner(source_kind)")
    .eq("status", "published")
    .eq("article_sources.source_kind", "coaching")
    .gte("created_at", range.start.toISOString())
    .lt("created_at", range.end.toISOString())
    .order("created_at", { ascending: true });

  if (error) console.error("Digest article fetch failed:", error.message);
  const articles = data || [];

  return (
    <main className="print-document min-h-screen bg-slate-100 px-4 py-10 text-slate-900 print:bg-white print:p-0">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 print:hidden">
          <Link href="/pdf" className="font-bold text-cyan-700">← PDF library</Link>
          <PrintActions />
        </div>

        <header className="rounded-2xl bg-slate-950 p-8 text-white print:rounded-none print:border-b-4 print:border-slate-900 print:bg-white print:px-0 print:text-slate-950">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-cyan-400 print:text-slate-600">CurrentPulse AI</p>
          <h1 className="mt-3 text-4xl font-black capitalize">{period} current-affairs digest</h1>
          <p className="mt-3 text-slate-300 print:text-slate-600">{range.label}</p>
          <p className="mt-5 text-sm text-slate-400 print:text-slate-600">
            {articles.length} coaching-synthesised {articles.length === 1 ? "brief" : "briefs"} in this date range
          </p>
        </header>

        {articles.length ? (
          <div className="mt-6 space-y-6 print:mt-2 print:space-y-0">
            {articles.map((article, index) => (
              <article key={article.id} className="break-inside-avoid rounded-2xl bg-white p-7 shadow-sm print:rounded-none print:border-b print:border-slate-300 print:px-0 print:py-6 print:shadow-none">
                <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-600">
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <span>•</span>
                  <span>{article.category || "Current Affairs"}</span>
                  <span>•</span>
                  <span>{article.paper || "General Studies"}</span>
                </div>
                <h2 className="mt-3 text-2xl font-black leading-snug">{article.title}</h2>

                <section className="mt-5">
                  <h3 className="text-sm font-black uppercase tracking-wider text-cyan-700">Why in news</h3>
                  <ArticleContent content={article.why_news} fallback="Analysis unavailable." />
                </section>
                {article.prelims && (
                  <section className="mt-5">
                    <h3 className="text-sm font-black uppercase tracking-wider text-cyan-700">Prelims focus</h3>
                    <ArticleContent content={article.prelims} />
                  </section>
                )}
                {article.mains && (
                  <section className="mt-5">
                    <h3 className="text-sm font-black uppercase tracking-wider text-cyan-700">Mains analysis</h3>
                    <ArticleContent content={article.mains} />
                  </section>
                )}
                {article.question && (
                  <div className="mt-5 rounded-lg border-l-4 border-amber-500 bg-amber-50 p-4 text-sm leading-6 text-slate-800">
                    <strong>Practice question:</strong> {article.question}
                  </div>
                )}
                <Link href={`/current-affairs/${article.slug}`} className="mt-5 inline-block text-sm font-bold text-cyan-700 print:hidden">
                  Open full article →
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl bg-white p-10 text-center shadow-sm">
            <h2 className="text-2xl font-bold">No articles in this period</h2>
            <p className="mt-3 text-slate-600">Choose another date or return after the publishing pipeline completes.</p>
            <Link href="/pdf" className="mt-6 inline-block font-bold text-cyan-700 print:hidden">Choose another digest</Link>
          </div>
        )}

        <footer className="mt-8 hidden border-t border-slate-300 pt-4 text-xs text-slate-500 print:block">
          Generated from the trusted-coaching Current Affairs stream. AI-collected news remains separate under News.
        </footer>
      </div>
    </main>
  );
}
