import Link from "next/link";
import ExamSubscriptionForm from "@/components/ExamSubscriptionForm";
import { loadExamUpdates } from "@/lib/exams/repository";
import { EXAM_TYPE_META } from "@/lib/exams/constants";
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
  title = "ResultPulse AI",
  description = "Official-source exam results, admit cards, answer keys, applications and deadlines - tracked in one place.",
}) {
  let updates = [];
  let error = null;
  try {
    const result = await loadExamUpdates({ type, limit: 30 });
    updates = result.updates || [];
    error = result.error || null;
  } catch (loadError) {
    console.error("ResultPulse page load failed:", loadError?.message || loadError);
    error = loadError instanceof Error ? loadError : new Error("ResultPulse is temporarily unavailable.");
  }

  return (
    <main className="min-h-screen bg-slate-950 py-10 text-white sm:py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <header className="overflow-hidden rounded-[2rem] border border-violet-400/20 bg-[radial-gradient(circle_at_85%_10%,rgba(139,92,246,.22),transparent_35%),linear-gradient(135deg,#111827,#020617)] p-7 sm:p-10">
          <p className="text-sm font-black uppercase tracking-[.22em] text-violet-300">CurrentPulse Exams</p>
          <h1 className="mt-3 text-4xl font-black sm:text-5xl">{title}</h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-300">{description}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href="/exams" className="rounded-full bg-violet-400 px-4 py-2 text-sm font-black text-slate-950">All updates</Link>
            {Object.entries(EXAM_TYPE_META).map(([key, meta]) => (
              <Link key={key} href={`/exams/${TYPE_ROUTE[key] || "notifications"}`} className="rounded-full border border-slate-700 px-4 py-2 text-sm font-bold text-slate-300 hover:border-violet-400">
                {meta.icon} {meta.label}
              </Link>
            ))}
          </div>
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
            <h2 className="text-2xl font-black">ResultPulse is ready for its first official-source scan</h2>
            <p className="mt-3 text-slate-400">Once the exam collector runs, verified official updates will appear here automatically.</p>
          </div>
        )}
        <div className="mt-10"><ExamSubscriptionForm /></div>
      </div>
    </main>
  );
}
