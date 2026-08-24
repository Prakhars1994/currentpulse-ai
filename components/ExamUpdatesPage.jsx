import Link from "next/link";
import ExamSubscriptionForm from "@/components/ExamSubscriptionForm";
import { loadExamUpdates } from "@/lib/exams/repository";
import { EXAM_TYPE_META } from "@/lib/exams/constants";
import { EXAM_FILTER_GROUPS, EXAM_FILTER_SOURCES, normalizeExamFilters } from "@/lib/exams/filters";
import { getExamUpdateDisplayType } from "@/lib/exams/displayType";

const TYPE_ROUTE = {
  result: "results",
  "admit-card": "admit-cards",
  notification: "notifications",
  "answer-key": "answer-keys",
  application: "applications",
  deadline: "deadlines",
  "exam-date": "exam-dates",
  "cut-off": "cut-offs",
  counselling: "counselling",
};

function filterClass(active) {
  return active
    ? "rounded-full bg-violet-400 px-4 py-2 text-sm font-black text-slate-950"
    : "rounded-full border border-slate-700 px-4 py-2 text-sm font-bold text-slate-300 hover:border-violet-400";
}

function dateText(value) {
  if (!value) return "Official update";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Official update";
  return date.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function ExamUpdatesPage({
  type = "",
  filters = {},
  page = 1,
  title = "ResultPulse AI",
  description = "Official-source exam results, admit cards, answer keys, applications and deadlines - tracked in one place.",
}) {
  const activeFilters = normalizeExamFilters({ ...filters, type: type || filters?.type || "" });
  const currentPage = Math.max(1, Number(page) || 1);
  const pageSize = 30;
  let updates = [];
  let hasMore = false;
  let error = null;
  try {
    const result = await loadExamUpdates({ ...activeFilters, limit: pageSize, offset: (currentPage - 1) * pageSize });
    updates = result.updates || [];
    hasMore = Boolean(result.hasMore);
    error = result.error || null;
  } catch (loadError) {
    console.error("ResultPulse page load failed:", loadError?.message || loadError);
    error = loadError instanceof Error ? loadError : new Error("ResultPulse is temporarily unavailable.");
  }

  const hasFilters = Boolean(activeFilters.type || activeFilters.group || activeFilters.source || activeFilters.q);
  const queryForPage = (targetPage) => {
    const query = new URLSearchParams();
    if (activeFilters.group) query.set("group", activeFilters.group);
    if (activeFilters.source) query.set("source", activeFilters.source);
    if (activeFilters.type) query.set("type", activeFilters.type);
    if (activeFilters.q) query.set("q", activeFilters.q);
    if (targetPage > 1) query.set("page", String(targetPage));
    const value = query.toString();
    return `/exams${value ? `?${value}` : ""}`;
  };

  return (
    <main className="min-h-screen bg-slate-950 py-10 text-white sm:py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <header className="overflow-hidden rounded-[2rem] border border-violet-400/20 bg-[radial-gradient(circle_at_85%_10%,rgba(139,92,246,.22),transparent_35%),linear-gradient(135deg,#111827,#020617)] p-7 sm:p-10">
          <p className="text-sm font-black uppercase tracking-[.22em] text-violet-300">CurrentPulse Exams</p>
          <h1 className="mt-3 text-4xl font-black sm:text-5xl">{title}</h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-300">{description}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href="/exams" className={filterClass(!activeFilters.type)}>All updates</Link>
            {Object.entries(EXAM_TYPE_META).map(([key, meta]) => (
              <Link key={key} href={`/exams/${TYPE_ROUTE[key] || "notifications"}`} className={filterClass(activeFilters.type === key)}>
                {meta.icon} {meta.label}
              </Link>
            ))}
          </div>
          <p className="mt-4 text-sm font-bold text-slate-400">Chronological official archive · Page {currentPage}</p>

          <form method="get" action="/exams" className="mt-7 rounded-2xl border border-slate-700/80 bg-slate-950/55 p-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <label className="text-xs font-black uppercase tracking-wide text-slate-400">
                Exam group
                <select name="group" defaultValue={activeFilters.group} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-3 text-sm font-bold text-white">
                  <option value="">All exam groups</option>
                  {EXAM_FILTER_GROUPS.map((group) => <option key={group} value={group}>{group}</option>)}
                </select>
              </label>
              <label className="text-xs font-black uppercase tracking-wide text-slate-400">
                Authority
                <select name="source" defaultValue={activeFilters.source} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-3 text-sm font-bold text-white">
                  <option value="">All authorities</option>
                  {EXAM_FILTER_SOURCES.map((source) => <option key={source.id} value={source.id}>{source.label}</option>)}
                </select>
              </label>
              <label className="text-xs font-black uppercase tracking-wide text-slate-400">
                Update type
                <select name="type" defaultValue={activeFilters.type} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-3 text-sm font-bold text-white">
                  <option value="">All update types</option>
                  {Object.entries(EXAM_TYPE_META).map(([key, meta]) => <option key={key} value={key}>{meta.label}</option>)}
                </select>
              </label>
              <label className="text-xs font-black uppercase tracking-wide text-slate-400 xl:col-span-2">
                Search exam
                <input type="search" name="q" defaultValue={activeFilters.q} placeholder="CSE, NDA, CDS, CGL, CHSL, NTPC..." maxLength={60} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-3 text-sm font-bold text-white placeholder:text-slate-600" />
              </label>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button type="submit" className="rounded-xl bg-violet-400 px-5 py-3 text-sm font-black text-slate-950">Apply filters</button>
              {hasFilters && <Link href="/exams" className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-black text-slate-300">Clear</Link>}
              <span className="text-xs font-bold text-slate-500">Server-side filters: no AI call and no client-side polling.</span>
            </div>
          </form>
        </header>

        {error && (
          <div className="mt-8 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-5 text-amber-200">
            ResultPulse database is not ready yet: {error.message}
          </div>
        )}

        <section className="mt-9 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {updates.map((item) => (
            <article key={item.id} className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl shadow-slate-950/20 transition hover:-translate-y-1 hover:border-violet-400/50">
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-full bg-violet-400/10 px-3 py-1 text-xs font-black uppercase text-violet-300">
                  {getExamUpdateDisplayType(item)}
                </span>
                <time className="text-xs text-slate-500">
                  {dateText(item.source_published_at || item.created_at)}
                </time>
              </div>
              <h2 className="mt-4 text-xl font-black leading-snug">
                <Link href={`/exams/${item.slug}`} className="hover:text-violet-300">{item.title}</Link>
              </h2>
              <p className="mt-3 line-clamp-3 leading-7 text-slate-400">
                {item.summary || `Official update from ${item.source_name || item.agency}.`}
              </p>
              <div className="mt-5 flex items-center justify-between border-t border-slate-800 pt-4">
                <span className="text-xs font-bold text-slate-500">{item.source_name || item.agency}</span>
                <Link href={`/exams/${item.slug}`} className="font-black text-violet-300">Open -&gt;</Link>
              </div>
            </article>
          ))}
        </section>

        {!updates.length && !error && (
          <div className="mt-9 rounded-3xl border border-dashed border-slate-700 p-10 text-center">
            <h2 className="text-2xl font-black">No official updates match this page</h2>
            <p className="mt-3 text-slate-400">Try clearing a filter or return to a newer archive page. ResultPulse keeps published official updates instead of removing old entries.</p>
          </div>
        )}
        {(currentPage > 1 || hasMore) && (
          <nav className="mt-9 flex flex-wrap items-center justify-center gap-3" aria-label="ResultPulse archive pagination">
            {currentPage > 1 && <Link href={queryForPage(currentPage - 1)} className="rounded-xl border border-slate-700 px-5 py-3 font-black text-slate-200">← Newer updates</Link>}
            <span className="text-sm font-bold text-slate-400">Page {currentPage}</span>
            {hasMore && <Link href={queryForPage(currentPage + 1)} className="rounded-xl bg-violet-400 px-5 py-3 font-black text-slate-950">Older updates →</Link>}
          </nav>
        )}
        <div className="mt-10"><ExamSubscriptionForm /></div>
      </div>
    </main>
  );
}
