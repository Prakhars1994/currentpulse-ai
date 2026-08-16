export const revalidate = 3600;

import Link from "next/link";
import { CalendarDays, FileDown, Layers3 } from "lucide-react";
import { indiaDate } from "@/lib/study/digestDates";

export const metadata = {
  title: "Current Affairs PDF Digests",
  description:
    "Daily, weekly and monthly printable UPSC current-affairs digests.",
  alternates: { canonical: "/pdf" },
};

function recentDates(today, count = 21) {
  const anchor = new Date(`${today}T12:00:00+05:30`);

  return Array.from({ length: count }, (_, index) => {
    const date = new Date(anchor);
    date.setDate(date.getDate() - index);
    return indiaDate(date);
  });
}

export default function PdfPage() {
  /*
   * The library index does not need to load the complete CA corpus.
   * Actual digest routes fetch their own bounded date range only when opened.
   */
  const today = indiaDate();
  const month = today.slice(0, 7);
  const dates = recentDates(today);

  return (
    <main className="pdf-library-theme min-h-screen px-6 py-14 text-white">
      <div className="mx-auto max-w-6xl">
        <p className="font-bold uppercase tracking-[0.24em] text-emerald-300">
          CurrentPulse digest builder
        </p>

        <h1 className="mt-3 text-4xl font-black sm:text-5xl">
          Current-affairs PDFs
        </h1>

        <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-400">
          Open a daily, weekly or monthly compilation. Article data is loaded
          only for the requested period instead of scanning the entire archive.
        </p>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          <Link
            href={`/pdf/daily?date=${today}`}
            className="rounded-2xl border border-cyan-500/40 bg-cyan-500/10 p-6 hover:border-cyan-300"
          >
            <CalendarDays className="text-cyan-300" />
            <h2 className="mt-5 text-xl font-bold">
              Today&apos;s digest
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Full daily revision brief.
            </p>
            <span className="mt-5 inline-block font-bold text-cyan-300">
              Open digest →
            </span>
          </Link>

          <Link
            href={`/pdf/weekly?date=${today}`}
            className="rounded-2xl border border-slate-800 bg-slate-900 p-6 hover:border-cyan-500"
          >
            <Layers3 className="text-cyan-300" />
            <h2 className="mt-5 text-xl font-bold">
              Weekly compilation
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Compact seven-day revision compilation.
            </p>
            <span className="mt-5 inline-block font-bold text-cyan-300">
              Open compilation →
            </span>
          </Link>

          <Link
            href={`/pdf/monthly?date=${month}`}
            className="rounded-2xl border border-slate-800 bg-slate-900 p-6 hover:border-cyan-500"
          >
            <FileDown className="text-cyan-300" />
            <h2 className="mt-5 text-xl font-bold">
              Monthly compilation
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Month-wise printable revision compilation.
            </p>
            <span className="mt-5 inline-block font-bold text-cyan-300">
              Open compilation →
            </span>
          </Link>
        </div>

        <div className="mt-14">
          <h2 className="text-2xl font-bold">Recent daily digests</h2>

          <p className="mt-2 text-slate-500">
            Select a date. The digest itself loads only that date&apos;s
            canonical Current Affairs.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {dates.map((date) => (
              <Link
                key={date}
                href={`/pdf/daily?date=${date}`}
                className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 p-5 transition hover:border-cyan-500"
              >
                <div>
                  <p className="font-bold">
                    {new Date(
                      `${date}T12:00:00+05:30`
                    ).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    Open daily digest
                  </p>
                </div>

                <FileDown className="text-cyan-400" size={20} />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}