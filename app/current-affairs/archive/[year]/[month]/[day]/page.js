import Link from "next/link";
import { notFound } from "next/navigation";
import { loadCurrentAffairsDatePage } from "@/lib/articleStreams";
import { repairedCaTitle, cleanPublicExcerpt } from "@/lib/publicArticleRepair";
import { SITE_URL } from "@/lib/siteUrl";

export const revalidate = 1800;

function validDate(year, month, day) {
  if (!/^\d{4}$/.test(year || "") || !/^\d{1,2}$/.test(month || "") || !/^\d{1,2}$/.test(day || "")) return false;
  const value = `${year}-${String(Number(month)).padStart(2, "0")}-${String(Number(day)).padStart(2, "0")}`;
  const parsed = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function parts(year, month, day) {
  return { mm: String(Number(month)).padStart(2, "0"), dd: String(Number(day)).padStart(2, "0") };
}

export async function generateMetadata({ params }) {
  const { year, month, day } = await params;
  if (!validDate(year, month, day)) notFound();
  const { mm, dd } = parts(year, month, day);
  const date = `${year}-${mm}-${dd}`;
  const label = new Date(`${date}T12:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
  const canonical = `${SITE_URL}/current-affairs/archive/${year}/${mm}/${dd}`;
  return {
    title: `${label} Current Affairs for UPSC | CurrentPulse`,
    description: `UPSC Current Affairs published on ${label}, with direct links to CurrentPulse study briefs for Prelims and Mains.`,
    alternates: { canonical },
    openGraph: { title: `${label} Current Affairs for UPSC`, description: `CurrentPulse daily UPSC Current Affairs archive for ${label}.`, url: canonical, type: "website" },
  };
}

export default async function DailyCurrentAffairsArchive({ params }) {
  const { year, month, day } = await params;
  if (!validDate(year, month, day)) notFound();
  const { mm, dd } = parts(year, month, day);
  const date = `${year}-${mm}-${dd}`;
  const result = await loadCurrentAffairsDatePage({ date, limit: 100, offset: 0, exam: "upsc", language: "en" });
  const articles = result.articles || [];
  if (!articles.length) notFound();
  const label = new Date(`${date}T12:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <nav aria-label="Breadcrumb" className="mb-5 text-sm">
          <Link href="/current-affairs">Current Affairs</Link> <span aria-hidden="true">→</span>{" "}
          <Link href={`/current-affairs/archive/${year}/${mm}`}>{new Date(Date.UTC(Number(year), Number(mm) - 1, 1)).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" })}</Link>{" "}
          <span aria-hidden="true">→</span> <span>{label}</span>
        </nav>
        <header>
          <h1 className="text-3xl font-black">{label} Current Affairs for UPSC</h1>
          <p className="mt-3 text-slate-300">{articles.length} published CurrentPulse study briefs for this date. Open any topic for its full UPSC-focused analysis.</p>
        </header>
        <section className="mt-8 space-y-4">
          {articles.map((article) => {
            const title = repairedCaTitle(article);
            return (
              <article key={article.id || article.slug} className="rounded-xl border border-slate-700 p-5">
                <h2 className="text-xl font-bold"><Link href={`/current-affairs/${article.slug}`}>{title}</Link></h2>
                <p className="mt-2 text-slate-300">{cleanPublicExcerpt(article.why_news || article.content, title, 280)}</p>
                <Link className="mt-3 inline-block font-bold text-cyan-300" href={`/current-affairs/${article.slug}`}>Read UPSC brief →</Link>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
