
import Link from "next/link";
import { EXAM_VERTICALS } from "@/lib/examPrep/sourceRegistry";

export const metadata = {
  title: "Free Mock Tests - UPSC, SSC, Railway, Banking & State PCS",
  description: "Ten free guest mock tests per major exam with instant deterministic evaluation and no login requirement.",
  alternates: { canonical: "/mock-tests" },
};

export default function MockTestsPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-12 text-white sm:px-6">
      <div className="mx-auto max-w-7xl">
        <p className="font-black uppercase tracking-[.22em] text-cyan-300">Free · guest attempt · ₹0 AI per student</p>
        <h1 className="mt-3 text-4xl font-black sm:text-5xl">Mock tests by exam</h1>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-400">UPSC, SSC, Railway, Banking and State PCS each get 10 free tests. Scoring, negative marking and answer review happen deterministically in the browser.</p>
        <div className="mt-6"><Link href="/quiz" className="rounded-xl border border-violet-400/30 bg-violet-400/10 px-4 py-2 font-bold text-violet-200">Daily Current Affairs Quiz →</Link></div>
        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {Object.values(EXAM_VERTICALS).map((exam) => <article key={exam.slug} className="rounded-3xl border border-slate-800 bg-slate-900 p-6"><p className="text-sm font-black uppercase tracking-[.16em] text-cyan-300">{exam.label}</p><h2 className="mt-2 text-2xl font-black">10 free mocks</h2><p className="mt-3 text-sm leading-6 text-slate-400">{exam.subjects.join(" · ")}</p><Link href={`/mock-tests/${exam.slug}`} className="mt-5 inline-block rounded-xl bg-cyan-400 px-5 py-3 font-black text-slate-950">Open {exam.label} mocks →</Link></article>)}
        </div>
      </div>
    </main>
  );
}
