export const revalidate = 120;

import Link from "next/link";
import { CalendarDays, FileDown, Layers3 } from "lucide-react";
import { indiaDate } from "@/lib/study/digestDates";
import { loadCurrentAffairsCorpus } from "@/lib/articleStreams";

export const metadata = {
  title: "Current Affairs PDF Digests",
  description: "Daily, weekly and monthly printable UPSC current-affairs digests built from the canonical public CA corpus.",
  alternates: { canonical: "/pdf" },
};

export default async function PdfPage() {
  const { articles, error } = await loadCurrentAffairsCorpus({ maxScan: 5000 });
  if (error) console.error("PDF library fetch failed:", error.message);

  const counts = new Map();
  for (const article of articles) {
    if (!article.created_at) continue;
    const date = indiaDate(new Date(article.created_at));
    counts.set(date, (counts.get(date) || 0) + 1);
  }
  const dates = [...counts.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 21);
  const today = indiaDate();
  const month = today.slice(0, 7);

  return (
    <main className="pdf-library-theme min-h-screen px-6 py-14 text-white">
      <div className="mx-auto max-w-6xl">
        <p className="font-bold uppercase tracking-[0.24em] text-emerald-300">Canonical digest builder</p>
        <h1 className="mt-3 text-4xl font-black sm:text-5xl">Current-affairs PDFs</h1>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-400">
          The archive now uses exactly the same publication-safe, deduplicated
          Current Affairs visibility rules as the public CA archive.
        </p>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          <Link href={`/pdf/daily?date=${today}`} className="rounded-2xl border border-cyan-500/40 bg-cyan-500/10 p-6 hover:border-cyan-300">
            <CalendarDays className="text-cyan-300" />
            <h2 className="mt-5 text-xl font-bold">Today&apos;s digest</h2>
            <p className="mt-2 text-sm text-slate-400">Full daily revision brief.</p>
            <span className="mt-5 inline-block font-bold text-cyan-300">Open digest →</span>
          </Link>
          <Link href={`/pdf/weekly?date=${today}`} className="rounded-2xl border border-slate-800 bg-slate-900 p-6 hover:border-cyan-500">
            <Layers3 className="text-cyan-300" />
            <h2 className="mt-5 text-xl font-bold">Weekly compilation</h2>
            <p className="mt-2 text-sm text-slate-400">Compact seven-day revision compilation.</p>
            <span className="mt-5 inline-block font-bold text-cyan-300">Open compilation →</span>
          </Link>
          <Link href={`/pdf/monthly?date=${month}`} className="rounded-2xl border border-slate-800 bg-slate-900 p-6 hover:border-cyan-500">
            <FileDown className="text-cyan-300" />
            <h2 className="mt-5 text-xl font-bold">Monthly compilation</h2>
            <p className="mt-2 text-sm text-slate-400">Compact month-wise revision index instead of a huge server render.</p>
            <span className="mt-5 inline-block font-bold text-cyan-300">Open compilation →</span>
          </Link>
        </div>

        <div className="mt-14">
          <h2 className="text-2xl font-bold">Daily archive</h2>
          <p className="mt-2 text-slate-500">Counts match the canonical visible CA corpus.</p>
          {dates.length ? (
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {dates.map(([date, count]) => (
                <Link key={date} href={`/pdf/daily?date=${date}`} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 p-5 transition hover:border-cyan-500">
                  <div>
                    <p className="font-bold">{new Date(`${date}T12:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>
                    <p className="mt-1 text-sm text-slate-500">{count} {count === 1 ? "article" : "articles"}</p>
                  </div>
                  <FileDown className="text-cyan-400" size={20} />
                </Link>
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-800 p-8 text-center text-slate-400">No recent published articles are available for a digest.</div>
          )}
        </div>
      </div>
    </main>
  );
}
