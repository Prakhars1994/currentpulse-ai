import Link from "next/link";
import { notFound } from "next/navigation";
import { loadCurrentAffairsDates } from "@/lib/articleStreams";
import { SITE_URL } from "@/lib/siteUrl";

export const revalidate = 3600;

function validPart(value, min, max) {
  return /^\d+$/.test(value || "") && Number(value) >= min && Number(value) <= max;
}

function monthLabel(year, month) {
  return new Date(Date.UTC(Number(year), Number(month) - 1, 1)).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export async function generateMetadata({ params }) {
  const { year, month } = await params;
  if (!validPart(year, 2020, 2100) || !validPart(month, 1, 12)) notFound();
  const mm = String(Number(month)).padStart(2, "0");
  const canonical = `${SITE_URL}/current-affairs/archive/${year}/${mm}`;
  const label = monthLabel(year, mm);
  return {
    title: `${label} Current Affairs for UPSC | CurrentPulse`,
    description: `Browse ${label} UPSC Current Affairs day by day, with links to published CurrentPulse study briefs.`,
    alternates: { canonical },
    openGraph: { title: `${label} Current Affairs for UPSC`, description: `Daily UPSC Current Affairs archive for ${label}.`, url: canonical, type: "website" },
  };
}

export default async function MonthlyCurrentAffairsArchive({ params }) {
  const { year, month } = await params;
  if (!validPart(year, 2020, 2100) || !validPart(month, 1, 12)) notFound();
  const mm = String(Number(month)).padStart(2, "0");
  const prefix = `${year}-${mm}-`;
  const allDates = (await loadCurrentAffairsDates({ language: "en" })).dates || [];
  const dates = allDates.filter((date) => date.startsWith(prefix));
  if (!dates.length) notFound();
  const label = monthLabel(year, mm);
  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <nav aria-label="Breadcrumb" className="mb-5 text-sm">
          <Link href="/current-affairs">Current Affairs</Link> <span aria-hidden="true">→</span> <span>{label}</span>
        </nav>
        <header>
          <h1 className="text-3xl font-black">{label} Current Affairs for UPSC</h1>
          <p className="mt-3 text-slate-300">Browse every published study date in {label}. Each daily page links directly to its CurrentPulse Current Affairs briefs.</p>
        </header>
        <nav aria-label={`${label} daily Current Affairs`} className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {dates.map((date) => (
            <Link key={date} href={`/current-affairs/archive/${date.replaceAll("-", "/")}`} className="rounded-xl border border-slate-700 p-4 font-bold hover:border-cyan-400">
              {new Date(`${date}T12:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" })}
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}
