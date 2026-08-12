import Link from "next/link";
import { hasCoachingSource } from "@/lib/articleStreams";
import { resolveDisplayImage } from "@/lib/news/categoryImage";
import { VALID_CATEGORIES } from "@/lib/contentTaxonomy";

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

function formatDate(value: string | null) {
  if (!value) return "Today";
  return new Date(value).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function Hero({ featured = null, articleCount = 0 }: { featured?: any; articleCount?: number }) {
  const categoryCount = VALID_CATEGORIES.length;
  const coachingSourceCount = 8;

  const featuredImage = resolveDisplayImage(featured || {});
  const featuredIsCurrentAffairs = hasCoachingSource(featured || {});
  const featuredStreamLabel = featuredIsCurrentAffairs ? "Coaching current affairs" : "Latest news";
  const featuredPath = featured ? `${featuredIsCurrentAffairs ? "/current-affairs" : "/news"}/${featured.slug}` : "/current-affairs";

  return (
    <section className="relative overflow-hidden border-b border-white/5 bg-[radial-gradient(circle_at_12%_8%,rgba(6,182,212,.16),transparent_30%),radial-gradient(circle_at_90%_70%,rgba(37,99,235,.18),transparent_33%),linear-gradient(135deg,#020617,#0f172a_55%,#111827)]">
      <div className="absolute inset-0" aria-hidden="true">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-blue-500/20 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_.95fr] xl:gap-16">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-bold text-cyan-200 shadow-lg shadow-cyan-950/20">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> Updated daily · Source-backed
            </span>

            <h1 className="mt-7 max-w-3xl text-5xl font-black leading-[1.05] tracking-[-0.045em] text-white sm:text-6xl xl:text-7xl">
              Current affairs that connect
              <span className="block bg-gradient-to-r from-cyan-300 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
                news to the UPSC syllabus
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
              Revise the trigger, static foundation, verified evidence, Prelims
              traps and Mains dimensions in one selection-oriented brief.
            </p>

            <div className="mt-6 flex flex-wrap gap-2.5 text-sm font-semibold text-slate-200">
              {["Exact syllabus link", "Current + static", "Maps & memory aids", "Answer framework"].map((label) => (
                <span key={label} className="rounded-full border border-white/10 bg-white/[.055] px-3.5 py-2">✓ {label}</span>
              ))}
            </div>

            {/* Homepage Search */}
            <form
              action="/search"
              method="GET"
              className="mt-8 flex max-w-2xl flex-col gap-3 rounded-2xl border border-white/10 bg-slate-900/65 p-3 shadow-2xl shadow-slate-950/25 backdrop-blur sm:flex-row"
            >
              <div className="relative flex-1">
                <span
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-gray-400"
                  aria-hidden="true"
                >
                  🔍
                </span>

                <input
                  type="search"
                  name="q"
                  required
                  aria-label="Search current affairs"
                  placeholder="Search topics, categories or GS papers..."
                  className="h-14 w-full rounded-xl border border-white/10 bg-slate-950/70 pl-12 pr-4 text-white outline-none transition placeholder:text-gray-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
                />
              </div>

              <button
                type="submit"
                className="h-14 rounded-xl bg-cyan-500 px-7 font-bold text-slate-950 transition hover:bg-cyan-400"
              >
                Search
              </button>
            </form>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/current-affairs"
                className="rounded-xl bg-gradient-to-r from-cyan-400 to-cyan-500 px-7 py-3.5 font-black text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:-translate-y-0.5 hover:from-cyan-300 hover:to-cyan-400"
              >
                Read Today&apos;s Current Affairs
              </Link>

              <Link
                href="/ai"
                className="rounded-xl border border-white/15 bg-white/[.035] px-7 py-3.5 font-bold text-white transition hover:border-cyan-400/50 hover:bg-cyan-400/10"
              >
                🤖 Ask CurrentPulse AI
              </Link>
            </div>

            <div className="mt-10 grid grid-cols-3 gap-2 sm:gap-3">
              <div className="rounded-2xl border border-white/8 bg-white/[.035] p-3 sm:p-4">
                <p className="text-3xl font-bold text-cyan-400 sm:text-4xl">
                  {(articleCount || 0).toLocaleString("en-IN")}
                </p>

                <p className="mt-2 text-sm text-gray-400 sm:text-base">
                  Published records
                </p>
              </div>

              <div className="rounded-2xl border border-white/8 bg-white/[.035] p-3 sm:p-4">
                <p className="text-3xl font-bold text-cyan-400 sm:text-4xl">
                  {categoryCount.toLocaleString("en-IN")}
                </p>

                <p className="mt-2 text-sm text-gray-400 sm:text-base">
                  Categories
                </p>
              </div>

              <div className="rounded-2xl border border-white/8 bg-white/[.035] p-3 sm:p-4">
                <p className="text-3xl font-bold text-cyan-400 sm:text-4xl">
                  {coachingSourceCount.toLocaleString("en-IN")}
                </p>

                <p className="mt-2 text-sm text-gray-400 sm:text-base">
                  Trusted coaching feeds
                </p>
              </div>
            </div>
          </div>

          <div>
            {featured ? (
              <article className="group overflow-hidden rounded-[1.75rem] border border-cyan-400/20 bg-slate-900/90 shadow-2xl shadow-slate-950/50 ring-1 ring-white/5">
                <Link
                  href={featuredPath}
                  className="block overflow-hidden"
                >
                  {featuredImage ? (
                    <img src={featuredImage} alt={featured.title || "Featured article"} className="h-60 w-full object-cover transition duration-700 group-hover:scale-[1.035] sm:h-72" loading="eager" />
                  ) : (
                    <div className="h-36 bg-gradient-to-br from-slate-900 via-cyan-950/70 to-blue-950 sm:h-44" />
                  )}
                </Link>

                <div className="p-6 sm:p-8">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-[.12em]">
                    <span className="rounded-full bg-cyan-400 px-3 py-1.5 text-slate-950">{featuredStreamLabel}</span>
                    <span className="rounded-full border border-slate-700 bg-slate-950/80 px-3 py-1.5 text-slate-300">{featured.category || "Current Affairs"}</span>
                  </div>

                  <Link href={featuredPath}>
                    <h2 className="mt-5 text-2xl font-black leading-tight tracking-tight text-white transition hover:text-cyan-300 sm:text-3xl">
                      {featured.title}
                    </h2>
                  </Link>

                  <p className="mt-4 line-clamp-3 leading-7 text-slate-300">
                    {stripHtml(featured.why_news) ||
                      "Read the complete current affairs analysis."}
                  </p>

                  <div className="mt-7 flex items-center justify-between gap-4 border-t border-slate-800 pt-5">
                    <div className="text-sm text-slate-400"><span className="font-bold text-blue-300">{featured.paper || "General Studies"}</span> · {formatDate(featured.created_at)}</div>

                    <Link
                      href={featuredPath}
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
